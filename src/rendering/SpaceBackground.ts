/**
 * Space Background Renderer
 * Multi-layered pixel art space background with warp distortion support
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer, Color } from '@core/Renderer';

export interface SpaceBackgroundConfig {
    starCount: number;
    starLayers: number;
    parallaxStrength: number;
    enableDistortion: boolean;
    galaxyBandIntensity: number;
    nebulaOpacity: number;
}

export interface BackgroundStar {
    position: Vector2;
    originalPosition: Vector2; // For distortion restoration
    color: Color;
    size: number;
    layer: number; // 0-4 for parallax
    twinkle: number; // Twinkle phase
}

export interface SpaceDistortionData {
    center: Vector2;
    intensity: number; // 0-1
    radius: number;
}

export class SpaceBackground {
    private config: SpaceBackgroundConfig;
    private stars: BackgroundStar[] = [];
    private galaxyBand: BackgroundStar[] = [];
    private nebulaClouds: Array<{ x: number, y: number, size: number, color: Color }> = [];
    
    // Distortion state
    private isDistorted: boolean = false;
    private distortionData: SpaceDistortionData | null = null;
    
    // Animation
    private time: number = 0;
    
    private logger: Logger;

    constructor(config: Partial<SpaceBackgroundConfig> = {}) {
        this.logger = new Logger('SpaceBackground');
        
        this.config = {
            starCount: 300,
            starLayers: 5,
            parallaxStrength: 0.3,
            enableDistortion: true,
            galaxyBandIntensity: 0.4,
            nebulaOpacity: 0.2,
            ...config
        };
        
        this.generateBackground();
        
        this.logger.info('🌌 Space background initialized', {
            starCount: this.stars.length,
            layers: this.config.starLayers
        });
    }

    /**
     * Generate the complete background
     */
    private generateBackground(): void {
        this.generateStars();
        this.generateGalaxyBand();
        this.generateNebulae();
    }

    /**
     * Generate background stars with multiple layers for parallax
     */
    private generateStars(): void {
        this.stars = [];
        
        for (let i = 0; i < this.config.starCount; i++) {
            const position = {
                x: Math.random() * 2048, // Larger than screen for movement
                y: Math.random() * 1536
            };
            
            const layer = Math.floor(Math.random() * this.config.starLayers);
            const size = this.getStarSize(layer);
            const color = this.getStarColor();
            
            this.stars.push({
                position: { ...position },
                originalPosition: { ...position },
                color,
                size,
                layer,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * Generate galaxy band (Milky Way-like band across sky)
     */
    private generateGalaxyBand(): void {
        this.galaxyBand = [];
        const bandStars = 80;
        
        // Create a diagonal band across the screen
        for (let i = 0; i < bandStars; i++) {
            const progress = i / bandStars;
            const bandWidth = 200;
            const bandOffset = Math.sin(progress * Math.PI * 3) * 50; // Wavy band
            
            const position = {
                x: progress * 2048 + bandOffset,
                y: 400 + bandOffset + (Math.random() - 0.5) * bandWidth
            };
            
            // Dense, small stars for galaxy band
            const color = this.getGalaxyBandColor();
            
            this.galaxyBand.push({
                position: { ...position },
                originalPosition: { ...position },
                color,
                size: Math.random() * 1.5 + 0.5,
                layer: 2, // Middle layer
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }

    /**
     * Generate nebula clouds
     */
    private generateNebulae(): void {
        this.nebulaClouds = [];
        const nebulaCount = 5;
        
        for (let i = 0; i < nebulaCount; i++) {
            this.nebulaClouds.push({
                x: Math.random() * 2048,
                y: Math.random() * 1536,
                size: Math.random() * 150 + 100,
                color: this.getNebulaColor()
            });
        }
    }

    /**
     * Get star size based on layer (closer = bigger)
     */
    private getStarSize(layer: number): number {
        const baseSizes = [3, 2.5, 2, 1.5, 1]; // Layer 0 = closest/biggest
        return baseSizes[layer] + Math.random() * 0.5;
    }

    /**
     * Get star color (dark, muted space colors)
     */
    private getStarColor(): Color {
        const colors = [
            { r: 64, g: 64, b: 64 },  // White (muted)
            { r: 48, g: 44, b: 36 },  // Yellow-white
            { r: 48, g: 40, b: 28 },  // Yellow
            { r: 48, g: 32, b: 20 },  // Orange
            { r: 48, g: 24, b: 16 },  // Red
            { r: 32, g: 36, b: 48 },  // Blue
            { r: 40, g: 44, b: 48 }   // Blue-white
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Get galaxy band star color (warmer, denser appearance)
     */
    private getGalaxyBandColor(): Color {
        const colors = [
            { r: 48, g: 44, b: 28 },  // Warm white
            { r: 48, g: 40, b: 24 },  // Warm yellow
            { r: 32, g: 28, b: 20 },  // Dim orange
            { r: 24, g: 24, b: 20 }   // Very dim
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Get nebula color (very muted space dust)
     */
    private getNebulaColor(): Color {
        const colors = [
            { r: 24, g: 16, b: 32 },  // Purple nebula
            { r: 32, g: 24, b: 16 },  // Brown nebula
            { r: 16, g: 24, b: 32 },  // Blue nebula
            { r: 24, g: 32, b: 16 }   // Green nebula
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Update background animation
     */
    update(deltaTime: number): void {
        this.time += deltaTime;
        
        // Update star twinkle animation
        this.stars.forEach(star => {
            star.twinkle += deltaTime * (0.5 + Math.random() * 0.5);
        });
        
        this.galaxyBand.forEach(star => {
            star.twinkle += deltaTime * 0.3; // Slower twinkle for galaxy band
        });
    }

    /**
     * Apply warp distortion to background
     */
    applyWarpDistortion(distortionData: SpaceDistortionData): void {
        if (!this.config.enableDistortion) return;
        
        this.distortionData = { ...distortionData };
        this.isDistorted = true;
        
        // Apply distortion to all stars
        this.distortStars(this.stars, distortionData);
        this.distortStars(this.galaxyBand, distortionData);
        
        this.logger.debug('🌀 Warp distortion applied to background');
    }

    /**
     * Restore background from distortion
     */
    restoreFromDistortion(): void {
        if (!this.isDistorted) return;
        
        // Restore all stars to original positions
        this.stars.forEach(star => {
            star.position = { ...star.originalPosition };
        });
        
        this.galaxyBand.forEach(star => {
            star.position = { ...star.originalPosition };
        });
        
        this.isDistorted = false;
        this.distortionData = null;
        
        this.logger.debug('🌌 Background restored from warp distortion');
    }

    /**
     * Gradually restore background during warp deactivation
     */
    gradualRestore(progress: number): void {
        if (!this.isDistorted || !this.distortionData) return;
        
        const restoreAmount = 1.0 - progress; // 1.0 = fully restored, 0.0 = fully distorted
        
        // Gradually restore stars
        this.restoreStarsGradually(this.stars, restoreAmount);
        this.restoreStarsGradually(this.galaxyBand, restoreAmount);
    }

    /**
     * Apply distortion to a set of stars
     */
    private distortStars(stars: BackgroundStar[], distortionData: SpaceDistortionData): void {
        stars.forEach(star => {
            const dx = star.originalPosition.x - distortionData.center.x;
            const dy = star.originalPosition.y - distortionData.center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < distortionData.radius) {
                // Calculate distortion strength based on distance
                const distortionStrength = (1 - distance / distortionData.radius) * distortionData.intensity;
                
                // Apply distortion toward the center
                const pullStrength = distortionStrength * 50 * (star.layer + 1); // Closer layers distort more
                
                star.position.x = star.originalPosition.x - (dx / distance) * pullStrength;
                star.position.y = star.originalPosition.y - (dy / distance) * pullStrength;
            }
        });
    }

    /**
     * Gradually restore stars during deactivation
     */
    private restoreStarsGradually(stars: BackgroundStar[], restoreAmount: number): void {
        stars.forEach(star => {
            // Interpolate between distorted and original position
            star.position.x = star.position.x + (star.originalPosition.x - star.position.x) * restoreAmount * 0.1;
            star.position.y = star.position.y + (star.originalPosition.y - star.position.y) * restoreAmount * 0.1;
        });
    }

    /**
     * Render the space background
     */
    render(renderer: Renderer, cameraPosition: Vector2): void {
        // Render nebulae first (background layer)
        this.renderNebulae(renderer, cameraPosition);
        
        // Render galaxy band
        this.renderGalaxyBand(renderer, cameraPosition);
        
        // Render stars in layers (back to front for parallax)
        for (let layer = this.config.starLayers - 1; layer >= 0; layer--) {
            this.renderStarLayer(renderer, cameraPosition, layer);
        }
    }

    /**
     * Render nebula clouds
     */
    private renderNebulae(renderer: Renderer, cameraPosition: Vector2): void {
        this.nebulaClouds.forEach(nebula => {
            const parallaxFactor = 0.1; // Very slow parallax for distant nebulae
            const screenX = nebula.x - cameraPosition.x * parallaxFactor;
            const screenY = nebula.y - cameraPosition.y * parallaxFactor;
            
            // Skip if off-screen
            if (screenX < -nebula.size || screenX > 1024 + nebula.size ||
                screenY < -nebula.size || screenY > 768 + nebula.size) {
                return;
            }
            
            // Render nebula as scattered pixels
            const pixelCount = Math.floor(nebula.size / 8);
            for (let i = 0; i < pixelCount; i++) {
                const angle = (i / pixelCount) * Math.PI * 2 + this.time * 0.1;
                const radius = (nebula.size / 2) * Math.sqrt(Math.random()); // Even distribution
                
                const x = screenX + Math.cos(angle) * radius;
                const y = screenY + Math.sin(angle) * radius;
                
                const alpha = this.config.nebulaOpacity * (1 - radius / (nebula.size / 2));
                const color = {
                    r: Math.floor(nebula.color.r * alpha),
                    g: Math.floor(nebula.color.g * alpha),
                    b: Math.floor(nebula.color.b * alpha)
                };
                
                if (color.r > 0 || color.g > 0 || color.b > 0) {
                    renderer.setPixel(x, y, color);
                }
            }
        });
    }

    /**
     * Render galaxy band
     */
    private renderGalaxyBand(renderer: Renderer, cameraPosition: Vector2): void {
        this.galaxyBand.forEach(star => {
            const parallaxFactor = 0.3; // Medium parallax for galaxy band
            const screenX = star.position.x - cameraPosition.x * parallaxFactor;
            const screenY = star.position.y - cameraPosition.y * parallaxFactor;
            
            // Skip if off-screen
            if (screenX < -10 || screenX > 1034 || screenY < -10 || screenY > 778) {
                return;
            }
            
            // Apply galaxy band intensity and twinkle
            const twinkle = Math.sin(star.twinkle) * 0.3 + 0.7; // 0.4 to 1.0
            const intensity = this.config.galaxyBandIntensity * twinkle;
            
            const color = {
                r: Math.floor(star.color.r * intensity),
                g: Math.floor(star.color.g * intensity),
                b: Math.floor(star.color.b * intensity)
            };
            
            this.renderStar(renderer, screenX, screenY, star.size * 0.8, color);
        });
    }

    /**
     * Render stars for a specific parallax layer
     */
    private renderStarLayer(renderer: Renderer, cameraPosition: Vector2, layer: number): void {
        // Calculate parallax factor (layer 0 = closest, moves most)
        const parallaxFactor = (layer + 1) * this.config.parallaxStrength;
        
        this.stars.filter(star => star.layer === layer).forEach(star => {
            const screenX = star.position.x - cameraPosition.x * parallaxFactor;
            const screenY = star.position.y - cameraPosition.y * parallaxFactor;
            
            // Skip if off-screen
            if (screenX < -10 || screenX > 1034 || screenY < -10 || screenY > 778) {
                return;
            }
            
            // Apply twinkle effect
            const twinkle = Math.sin(star.twinkle) * 0.4 + 0.6; // 0.2 to 1.0
            const color = {
                r: Math.floor(star.color.r * twinkle),
                g: Math.floor(star.color.g * twinkle),
                b: Math.floor(star.color.b * twinkle)
            };
            
            this.renderStar(renderer, screenX, screenY, star.size, color);
        });
    }

    /**
     * Render individual star
     */
    private renderStar(renderer: Renderer, x: number, y: number, size: number, color: Color): void {
        if (size <= 1) {
            // Single pixel star
            renderer.setPixel(x, y, color);
        } else if (size <= 2) {
            // 2x2 star
            renderer.fillRect(x - 1, y - 1, 2, 2, color);
        } else {
            // Larger star with cross pattern
            const coreSize = Math.floor(size);
            const halfCore = Math.floor(coreSize / 2);
            
            // Core
            renderer.fillRect(x - halfCore, y - halfCore, coreSize, coreSize, color);
            
            // Cross pattern for larger stars
            if (size > 2.5) {
                const dimColor = {
                    r: Math.floor(color.r * 0.6),
                    g: Math.floor(color.g * 0.6),
                    b: Math.floor(color.b * 0.6)
                };
                
                // Horizontal beam
                renderer.fillRect(x - size, y - 1, size * 2, 2, dimColor);
                // Vertical beam
                renderer.fillRect(x - 1, y - size, 2, size * 2, dimColor);
            }
        }
    }

    /**
     * Update background during warp
     */
    updateWarpDistortion(distortionData: SpaceDistortionData): void {
        if (this.config.enableDistortion) {
            this.applyWarpDistortion(distortionData);
        }
    }

    /**
     * Get background statistics
     */
    getStats(): {
        starCount: number;
        galaxyBandStars: number;
        nebulaCount: number;
        isDistorted: boolean;
    } {
        return {
            starCount: this.stars.length,
            galaxyBandStars: this.galaxyBand.length,
            nebulaCount: this.nebulaClouds.length,
            isDistorted: this.isDistorted
        };
    }

    /**
     * Regenerate background (for different star systems)
     */
    regenerateBackground(): void {
        this.generateBackground();
        this.logger.info('🌌 Background regenerated');
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SpaceBackgroundConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Regenerate if significant changes
        if (newConfig.starCount || newConfig.starLayers) {
            this.regenerateBackground();
        }
    }
}