/**
 * HTML5 Canvas Renderer with 16-bit Aesthetic
 * Handles pixel-perfect rendering, WebGL shaders, and retro CRT effects
 */

import { Platform } from '@utils/Platform';
import { Logger } from '@utils/Logger';

export interface RenderConfig {
    pixelRatio: number;
    enablePixelPerfect: boolean;
    enableDithering: boolean;
    enableCRT: boolean;
    enablePostProcessing: boolean;
    backgroundColor: string;
}

export interface Color {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export interface Vector2 {
    x: number;
    y: number;
}

export interface Sprite {
    data: ImageData;
    width: number;
    height: number;
}

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private platform: Platform;
    private config: RenderConfig;
    
    // WebGL support for shaders
    private gl: WebGLRenderingContext | null = null;
    private shaderPrograms: Map<string, WebGLProgram> = new Map();
    
    // 16-bit color palette
    private colorPalette: Color[] = [];
    
    // Render targets
    private backBuffer!: ImageData;
    private frontBuffer!: ImageData;
    
    // Performance tracking
    private renderStats = {
        drawCalls: 0,
        triangles: 0,
        sprites: 0,
        particles: 0
    };
    
    private logger: Logger;

    constructor(canvas: HTMLCanvasElement, platform: Platform) {
        this.canvas = canvas;
        this.platform = platform;
        this.logger = new Logger('Renderer');
        
        // Get 2D context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.ctx = ctx;
        
        // Setup configuration
        this.config = {
            pixelRatio: window.devicePixelRatio || 1,
            enablePixelPerfect: true,
            enableDithering: true,
            enableCRT: platform !== Platform.Mobile, // Disable CRT on mobile for performance
            enablePostProcessing: platform === Platform.Desktop,
            backgroundColor: '#000000'
        };
        
        this.logger.info('🎨 Renderer initialized', {
            canvasSize: `${canvas.width}x${canvas.height}`,
            platform: platform,
            config: this.config
        });
    }

    /**
     * Initialize the renderer
     */
    async initialize(): Promise<void> {
        this.logger.info('🔧 Initializing renderer...');
        
        try {
            // Setup canvas for pixel-perfect rendering
            this.setupPixelPerfectCanvas();
            
            // Generate 16-bit color palette
            this.generateColorPalette();
            
            // Initialize WebGL if available and needed
            if (this.config.enableCRT || this.config.enablePostProcessing) {
                this.initializeWebGL();
            }
            
            // Create render buffers
            this.createRenderBuffers();
            
            this.logger.info('✅ Renderer initialization completed');
            
        } catch (error) {
            this.logger.error('❌ Renderer initialization failed', error);
            throw error;
        }
    }

    /**
     * Setup canvas for pixel-perfect rendering
     */
    private setupPixelPerfectCanvas(): void {
        // Disable image smoothing for pixel art
        this.ctx.imageSmoothingEnabled = false;
        (this.ctx as any).webkitImageSmoothingEnabled = false;
        (this.ctx as any).mozImageSmoothingEnabled = false;
        (this.ctx as any).msImageSmoothingEnabled = false;
        
        // Set pixel ratio scaling
        const scale = this.config.pixelRatio;
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
        this.canvas.width *= scale;
        this.canvas.height *= scale;
        this.ctx.scale(scale, scale);
        
        this.logger.debug('Canvas configured for pixel-perfect rendering', {
            scale: scale,
            size: `${this.canvas.width}x${this.canvas.height}`
        });
    }

        /**
     * Generate 16-bit color palette - Dark, muted, retro CRT style (Power of Ten/Alien 1979)
     */
    private generateColorPalette(): void {
        this.colorPalette = [
            // Deep blacks and dark grays (foundation)
            { r: 0, g: 0, b: 0 },           // Pure black
            { r: 8, g: 8, b: 8 },           // Very dark gray
            { r: 16, g: 16, b: 16 },        // Dark gray
            { r: 24, g: 24, b: 24 },        // Medium dark gray

            // Muted dark greens (classic terminal/CRT phosphor)
            { r: 4, g: 12, b: 4 },          // Very dark green
            { r: 8, g: 24, b: 8 },          // Dark green
            { r: 12, g: 36, b: 12 },        // Muted green
            { r: 16, g: 48, b: 16 },        // Terminal green

            // Worn amber/yellow (old CRT monitors)
            { r: 24, g: 16, b: 4 },         // Dark amber
            { r: 48, g: 32, b: 8 },         // Amber
            { r: 72, g: 48, b: 12 },        // Worn amber
            { r: 96, g: 64, b: 16 },        // Bright amber

            // Faded orange warnings (damaged systems)
            { r: 32, g: 16, b: 4 },         // Dark orange
            { r: 64, g: 32, b: 8 },         // Faded orange
            { r: 96, g: 48, b: 12 },        // Orange warning
            { r: 128, g: 64, b: 16 },       // Bright orange

            // Muted reds (critical alerts)
            { r: 24, g: 8, b: 8 },          // Very dark red
            { r: 48, g: 16, b: 16 },        // Dark red
            { r: 72, g: 24, b: 24 },        // Muted red
            { r: 96, g: 32, b: 32 },        // Alert red

            // Deep blue-grays (space/depth)
            { r: 8, g: 12, b: 20 },         // Deep blue-gray
            { r: 16, g: 24, b: 40 },        // Blue-gray
            { r: 24, g: 36, b: 60 },        // Space blue
            { r: 32, g: 48, b: 80 },        // Bright blue-gray

            // Faded cyan/teal (shields/energy)
            { r: 8, g: 20, b: 16 },         // Dark teal
            { r: 16, g: 40, b: 32 },        // Teal
            { r: 24, g: 60, b: 48 },        // Faded cyan
            { r: 32, g: 80, b: 64 },        // Bright teal

            // Muted purples (exotic/alien)
            { r: 16, g: 8, b: 24 },         // Dark purple
            { r: 32, g: 16, b: 48 },        // Purple
            { r: 48, g: 24, b: 72 },        // Muted purple
            { r: 64, g: 32, b: 96 },        // Bright purple

            // Light grays and worn whites
            { r: 32, g: 32, b: 32 },        // Medium gray
            { r: 48, g: 48, b: 48 },        // Light gray
            { r: 64, g: 64, b: 64 },        // Bright gray
            { r: 80, g: 80, b: 80 }         // Worn white
        ];

        this.logger.debug(`Generated dark retro 16-bit color palette with ${this.colorPalette.length} colors`);
    }

    /**
     * Initialize WebGL for shader effects
     */
    private initializeWebGL(): void {
        try {
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl') as WebGLRenderingContext;
            
            if (this.gl) {
                this.logger.info('✅ WebGL context initialized for shader effects');
                // TODO: Load and compile shaders in future phases
            } else {
                this.logger.info('📺 WebGL not supported, using optimized 2D canvas rendering');
                this.fallbackTo2D();
            }
        } catch (error) {
            this.logger.info('📺 WebGL unavailable, using 2D canvas fallback', error);
            this.gl = null;
            this.fallbackTo2D();
        }
    }

    /**
     * Fallback to 2D canvas rendering with optimizations
     */
    private fallbackTo2D(): void {
        this.config.enableCRT = false;
        this.config.enablePostProcessing = false;
        
        // Enable additional 2D optimizations
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Optimize for performance when WebGL is not available
        if ((this.ctx as any).willReadFrequently !== undefined) {
            (this.ctx as any).willReadFrequently = true;
        }
        
        this.logger.debug('2D canvas optimizations applied');
    }

    /**
     * Create render buffers for double buffering
     */
    private createRenderBuffers(): void {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.backBuffer = this.ctx.createImageData(width, height);
        this.frontBuffer = this.ctx.createImageData(width, height);
        
        // Fill with background color
        this.clearBuffer(this.backBuffer, this.hexToColor(this.config.backgroundColor));
        
        this.logger.debug('Render buffers created', { width, height });
    }

    /**
     * Begin frame rendering
     */
    beginFrame(): void {
        // Clear render stats
        this.renderStats.drawCalls = 0;
        this.renderStats.triangles = 0;
        this.renderStats.sprites = 0;
        this.renderStats.particles = 0;
        
        // Clear canvas
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear back buffer
        this.clearBuffer(this.backBuffer, this.hexToColor(this.config.backgroundColor));
    }

    /**
     * End frame rendering and apply post-processing
     */
    endFrame(): void {
        // Apply dithering if enabled
        if (this.config.enableDithering) {
            this.applyDithering(this.backBuffer);
        }
        
        // Copy back buffer to canvas
        this.ctx.putImageData(this.backBuffer, 0, 0);
        
        // Apply CRT effects if enabled
        if (this.config.enableCRT && this.gl) {
            this.applyCRTEffect();
        }
        
        this.renderStats.drawCalls++;
    }

    /**
     * Clear a buffer with a specific color
     */
    private clearBuffer(buffer: ImageData, color: Color): void {
        const data = buffer.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color.r;     // Red
            data[i + 1] = color.g; // Green
            data[i + 2] = color.b; // Blue
            data[i + 3] = color.a !== undefined ? color.a : 255; // Alpha
        }
    }

    /**
     * Set pixel in buffer with dithering
     */
    setPixel(x: number, y: number, color: Color): void {
        x = Math.floor(x);
        y = Math.floor(y);
        
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            return;
        }
        
        const index = (y * this.canvas.width + x) * 4;
        const data = this.backBuffer.data;
        
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = color.a !== undefined ? color.a : 255;
    }

    /**
     * Draw a filled rectangle
     */
    fillRect(x: number, y: number, width: number, height: number, color: Color): void {
        for (let py = y; py < y + height; py++) {
            for (let px = x; px < x + width; px++) {
                this.setPixel(px, py, color);
            }
        }
        this.renderStats.drawCalls++;
    }

    /**
     * Draw a line using Bresenham's algorithm
     */
    drawLine(x0: number, y0: number, x1: number, y1: number, color: Color): void {
        x0 = Math.floor(x0);
        y0 = Math.floor(y0);
        x1 = Math.floor(x1);
        y1 = Math.floor(y1);
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        let x = x0;
        let y = y0;
        
        while (true) {
            this.setPixel(x, y, color);
            
            if (x === x1 && y === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        
        this.renderStats.drawCalls++;
    }

    /**
     * Draw a circle
     */
    drawCircle(centerX: number, centerY: number, radius: number, color: Color, filled: boolean = false): void {
        centerX = Math.floor(centerX);
        centerY = Math.floor(centerY);
        radius = Math.floor(radius);
        
        if (filled) {
            // Filled circle
            for (let y = -radius; y <= radius; y++) {
                for (let x = -radius; x <= radius; x++) {
                    if (x * x + y * y <= radius * radius) {
                        this.setPixel(centerX + x, centerY + y, color);
                    }
                }
            }
        } else {
            // Circle outline using Bresenham's circle algorithm
            let x = 0;
            let y = radius;
            let d = 3 - 2 * radius;
            
            while (y >= x) {
                // Draw octants
                this.setPixel(centerX + x, centerY + y, color);
                this.setPixel(centerX - x, centerY + y, color);
                this.setPixel(centerX + x, centerY - y, color);
                this.setPixel(centerX - x, centerY - y, color);
                this.setPixel(centerX + y, centerY + x, color);
                this.setPixel(centerX - y, centerY + x, color);
                this.setPixel(centerX + y, centerY - x, color);
                this.setPixel(centerX - y, centerY - x, color);
                
                x++;
                if (d > 0) {
                    y--;
                    d = d + 4 * (x - y) + 10;
                } else {
                    d = d + 4 * x + 6;
                }
            }
        }
        
        this.renderStats.drawCalls++;
    }

    /**
     * Render text with retro font styling
     */
    renderText(text: string, x: number, y: number, color: Color, size: number = 12): void {
        // Save current context
        this.ctx.save();
        
        // Set font and color
        this.ctx.font = `${size}px "Courier New", monospace`;
        this.ctx.fillStyle = this.colorToHex(color);
        this.ctx.textBaseline = 'top';
        
        // Add retro glow effect
        this.ctx.shadowColor = this.colorToHex(color);
        this.ctx.shadowBlur = 2;
        
        // Render text
        this.ctx.fillText(text, x, y);
        
        // Restore context
        this.ctx.restore();
        
        this.renderStats.drawCalls++;
    }

    /**
     * Render debug text array
     */
    renderDebugText(lines: string[], x: number, y: number): void {
        const lineHeight = 14;
        const backgroundColor = { r: 0, g: 0, b: 0, a: 128 };
        const textColor = { r: 0, g: 255, b: 0 }; // Green terminal color
        
        // Draw background
        const maxWidth = Math.max(...lines.map(line => line.length)) * 8;
        this.fillRect(x - 2, y - 2, maxWidth + 4, lines.length * lineHeight + 4, backgroundColor);
        
        // Draw text lines
        lines.forEach((line, index) => {
            this.renderText(line, x, y + index * lineHeight, textColor, 12);
        });
    }

    /**
     * Generate procedural space ship sprite
     */
    generateShipSprite(type: 'player' | 'enemy' | 'ally', size: number = 32): Sprite {
        const imageData = this.ctx.createImageData(size, size);
        const data = imageData.data;
        
        // Clear to transparent
        for (let i = 0; i < data.length; i += 4) {
            data[i + 3] = 0; // Alpha = 0 (transparent)
        }
        
        // Ship colors based on type - much brighter and more visible
        let shipColor: Color;
        let accentColor: Color;
        switch (type) {
            case 'player':
                shipColor = { r: 80, g: 255, b: 80 }; // Bright green
                accentColor = { r: 200, g: 255, b: 200 }; // Light green accent
                break;
            case 'enemy':
                shipColor = { r: 255, g: 60, b: 60 }; // Bright red
                accentColor = { r: 255, g: 150, b: 150 }; // Light red accent
                break;
            case 'ally':
                shipColor = { r: 60, g: 180, b: 255 }; // Bright blue
                accentColor = { r: 150, g: 200, b: 255 }; // Light blue accent
                break;
        }
        
        const centerX = size / 2;
        const centerY = size / 2;
        
        // Draw detailed ship design
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                
                // Main ship body (arrow/triangle shape)
                if (dy >= -centerY * 0.9 && dy <= centerY * 0.7) {
                    const bodyWidth = Math.max(1, (centerY * 0.9 + dy) * 0.4);
                    if (Math.abs(dx) <= bodyWidth) {
                        const index = (y * size + x) * 4;
                        
                        // Use accent color for edges, main color for center
                        const isEdge = Math.abs(dx) > bodyWidth * 0.6 || 
                                      dy <= -centerY * 0.8 || dy >= centerY * 0.6;
                        const color = isEdge ? accentColor : shipColor;
                        
                        data[index] = color.r;
                        data[index + 1] = color.g;
                        data[index + 2] = color.b;
                        data[index + 3] = 255;
                    }
                }
                
                // Engine exhausts (bright spots at the back)
                if (dy > centerY * 0.4 && dy < centerY * 0.7) {
                    if ((Math.abs(dx - centerX * 0.3) < 2) || (Math.abs(dx + centerX * 0.3) < 2)) {
                        const index = (y * size + x) * 4;
                        data[index] = 255; // Bright white/blue exhaust
                        data[index + 1] = 255;
                        data[index + 2] = 255;
                        data[index + 3] = 255;
                    }
                }
            }
        }
        
        this.renderStats.sprites++;
        return {
            data: imageData,
            width: size,
            height: size
        };
    }

    /**
     * Draw a sprite
     */
    drawSprite(sprite: Sprite, x: number, y: number): void {
        this.ctx.putImageData(sprite.data, x, y);
        this.renderStats.sprites++;
    }

    /**
     * Apply dithering to reduce color banding
     */
    private applyDithering(buffer: ImageData): void {
        if (!this.config.enableDithering) return;
        
        const data = buffer.data;
        const width = buffer.width;
        const height = buffer.height;
        
        // Floyd-Steinberg dithering
        for (let y = 0; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = (y * width + x) * 4;
                
                // Get current pixel
                const oldR = data[index];
                const oldG = data[index + 1];
                const oldB = data[index + 2];
                
                // Find nearest palette color
                const newColor = this.findNearestPaletteColor({ r: oldR, g: oldG, b: oldB });
                
                // Set new color
                data[index] = newColor.r;
                data[index + 1] = newColor.g;
                data[index + 2] = newColor.b;
                
                // Calculate quantization error
                const errorR = oldR - newColor.r;
                const errorG = oldG - newColor.g;
                const errorB = oldB - newColor.b;
                
                // Distribute error to neighboring pixels
                this.distributeError(data, width, x + 1, y, errorR, errorG, errorB, 7/16);
                this.distributeError(data, width, x - 1, y + 1, errorR, errorG, errorB, 3/16);
                this.distributeError(data, width, x, y + 1, errorR, errorG, errorB, 5/16);
                this.distributeError(data, width, x + 1, y + 1, errorR, errorG, errorB, 1/16);
            }
        }
    }

    /**
     * Distribute dithering error to neighboring pixel
     */
    private distributeError(data: Uint8ClampedArray, width: number, x: number, y: number, 
                          errorR: number, errorG: number, errorB: number, factor: number): void {
        const index = (y * width + x) * 4;
        if (index >= 0 && index < data.length - 3) {
            data[index] = Math.max(0, Math.min(255, data[index] + errorR * factor));
            data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + errorG * factor));
            data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + errorB * factor));
        }
    }

    /**
     * Find nearest color in palette
     */
    private findNearestPaletteColor(color: Color): Color {
        let nearestColor = this.colorPalette[0];
        let minDistance = Number.MAX_VALUE;
        
        for (const paletteColor of this.colorPalette) {
            const distance = Math.sqrt(
                Math.pow(color.r - paletteColor.r, 2) +
                Math.pow(color.g - paletteColor.g, 2) +
                Math.pow(color.b - paletteColor.b, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestColor = paletteColor;
            }
        }
        
        return nearestColor;
    }

    /**
     * Apply CRT effect (basic implementation)
     */
    private applyCRTEffect(): void {
        // This would use WebGL shaders for proper CRT effects
        // For now, just apply scanlines via CSS (already done in HTML)
        this.logger.debug('CRT effect applied (CSS-based)');
    }

    /**
     * Handle canvas resize
     */
    handleResize(): void {
        // Recreate render buffers
        this.createRenderBuffers();
        this.logger.debug('Renderer resized');
    }

    /**
     * Convert hex color to Color object
     */
    private hexToColor(hex: string): Color {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    /**
     * Convert Color object to hex string
     */
    private colorToHex(color: Color): string {
        const toHex = (c: number) => {
            const hex = Math.round(c).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
    }

    /**
     * Get render statistics
     */
    getRenderStats() {
        return { ...this.renderStats };
    }

    /**
     * Draw a filled rectangle
     */
    drawRect(x: number, y: number, width: number, height: number, color: Color): void {
        this.ctx.fillStyle = this.colorToHex(color);
        this.ctx.fillRect(x, y, width, height);
    }



    /**
     * Cleanup resources
     */
    cleanup(): void {
        // Clear WebGL resources if available
        if (this.gl) {
            this.shaderPrograms.forEach(program => {
                this.gl!.deleteProgram(program);
            });
            this.shaderPrograms.clear();
        }
        
        this.logger.info('🧹 Renderer cleanup completed');
    }
}