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
 * Initialize the game with proper error handling
 */
async function initializeGame(): Promise<void> {
    const logger = new Logger('Main');
    
    try {
        logger.info('🚀 Starting Space Explorer 16-Bit initialization...');
        
        // Detect platform for adaptive features
        const platform = PlatformDetector.detect();
        logger.info(`Platform detected: ${platform}`);
        
        // Initialize canvas and context
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Game canvas not found');
        }
        
        // Adjust canvas for mobile
        if (platform === Platform.Mobile) {
            adjustCanvasForMobile(canvas);
        }
        
        // Initialize game engine
        game = new Game(canvas, platform);
        
        // Initialize game systems
        await game.initialize();
        
        // Setup event listeners
        setupEventListeners();
        
        // Start the game directly with main menu
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
    const targetRatio = 1440 / 900; // Updated for new resolution
    let width = containerRect.width - 20; // margin
    let height = width / targetRatio;
    
    if (height > containerRect.height - 20) {
        height = containerRect.height - 20;
        width = height * targetRatio;
    }
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    // Maintain internal resolution for pixel-perfect rendering
    canvas.width = 1440;
    canvas.height = 900;
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
    const gameContainer = document.getElementById('gameContainer')!;
    
    // Create error screen
    const errorScreen = document.createElement('div');
    errorScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        color: #f00;
        font-family: monospace;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    errorScreen.innerHTML = `
        <div style="text-align: center; max-width: 80%;">
            <h2 style="color: #f00; margin-bottom: 20px;">❌ INITIALIZATION FAILED</h2>
            <div style="background: rgba(255, 0, 0, 0.1); padding: 20px; border: 1px solid #f00; margin-bottom: 20px;">
                <div><strong>Error:</strong> ${error.message}</div>
                <pre style="font-size: 10px; margin-top: 10px; text-align: left;">${error.stack}</pre>
            </div>
            <div style="color: #ff0;">
                Please check the browser console for more details.
            </div>
        </div>
    `;
    
    gameContainer.appendChild(errorScreen);
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