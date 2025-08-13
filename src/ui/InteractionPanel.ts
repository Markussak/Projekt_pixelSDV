/**
 * Interaction Panel UI
 * Popup window for celestial body interactions with retro CRT styling
 */

import { Renderer, Color, Vector2 } from '@core/Renderer';
import { InputManager } from '@core/InputManager';
import { Logger } from '@utils/Logger';
import { InteractionZone, CelestialBody, ScanResult, MiningResult } from '@entities/CelestialBody';

export interface InteractionPanelConfig {
    enableAnimations: boolean;
    fadeSpeed: number;
    maxWidth: number;
    maxHeight: number;
}

export interface PanelInteractions {
    onEnterOrbit?: (bodyId: string) => void;
    onLand?: (bodyId: string) => void;
    onContinueFlight?: () => void;
    onStartMining?: (bodyId: string) => void;
    onPerformScan?: (bodyId: string) => void;
    onExitOrbit?: (bodyId: string) => void;
}

interface InteractionButton {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    enabled: boolean;
    color: Color;
    requirements?: string[];
}

export class InteractionPanel {
    private config: InteractionPanelConfig;
    private interactions: PanelInteractions;
    
    // Panel state
    private isVisible: boolean = false;
    private currentBody: CelestialBody | null = null;
    private currentZone: InteractionZone | null = null;
    private opacity: number = 0;
    private targetOpacity: number = 0;
    
    // Panel layout
    private panelX: number = 0;
    private panelY: number = 0;
    private panelWidth: number = 0;
    private panelHeight: number = 0;
    
    // Interactive elements
    private buttons: InteractionButton[] = [];
    private hoveredButton: string | null = null;
    private selectedButton: string | null = null;
    
    // Content data
    private bodyInfo: string = '';
    private scanData: ScanResult | null = null;
    private miningResults: MiningResult[] = [];
    
    private logger: Logger;

    constructor(
        config: Partial<InteractionPanelConfig> = {},
        interactions: PanelInteractions = {}
    ) {
        this.logger = new Logger('InteractionPanel');
        this.interactions = interactions;
        
        this.config = {
            enableAnimations: true,
            fadeSpeed: 3.0,
            maxWidth: 300,
            maxHeight: 200,
            ...config
        };
        
        this.logger.info('📱 Interaction panel initialized');
    }

    /**
     * Show interaction panel for a celestial body
     */
    showInteraction(body: CelestialBody, zone: InteractionZone, shipPosition: Vector2): void {
        this.currentBody = body;
        this.currentZone = zone;
        this.bodyInfo = body.getInteractionInfo();
        
        // Calculate panel position near the body
        this.calculatePanelPosition(body.position, shipPosition);
        
        // Setup buttons based on interaction type
        this.setupButtons();
        
        // Show panel with animation
        this.targetOpacity = 1.0;
        this.isVisible = true;
        
        this.logger.debug(`Showing interaction for ${body.name}`, {
            type: zone.type,
            canEnter: zone.canEnter
        });
    }

    /**
     * Hide the interaction panel
     */
    hideInteraction(): void {
        this.targetOpacity = 0.0;
        
        // Reset after fade out
        setTimeout(() => {
            if (this.targetOpacity === 0) {
                this.isVisible = false;
                this.currentBody = null;
                this.currentZone = null;
                this.scanData = null;
                this.miningResults = [];
            }
        }, this.config.enableAnimations ? 500 : 0);
        
        this.logger.debug('Hiding interaction panel');
    }

    /**
     * Calculate optimal panel position
     */
    private calculatePanelPosition(bodyPosition: Vector2, shipPosition: Vector2): void {
        // Base position relative to body (convert world to screen coordinates)
        const screenBodyX = bodyPosition.x - shipPosition.x + 512;
        const screenBodyY = bodyPosition.y - shipPosition.y + 384;
        
        // Panel dimensions
        this.panelWidth = Math.min(this.config.maxWidth, 280);
        this.panelHeight = Math.min(this.config.maxHeight, 180);
        
        // Position panel to the right of the body, avoiding screen edges
        this.panelX = screenBodyX + 60;
        this.panelY = screenBodyY - this.panelHeight / 2;
        
        // Keep panel on screen
        if (this.panelX + this.panelWidth > 1024) {
            this.panelX = screenBodyX - this.panelWidth - 60; // Move to left side
        }
        
        if (this.panelY < 20) this.panelY = 20;
        if (this.panelY + this.panelHeight > 500) { // Avoid cockpit area
            this.panelY = 500 - this.panelHeight;
        }
    }

    /**
     * Setup interaction buttons based on current zone
     */
    private setupButtons(): void {
        this.buttons = [];
        
        if (!this.currentZone || !this.currentBody) return;
        
        const buttonWidth = 80;
        const buttonHeight = 25;
        const buttonSpacing = 10;
        let currentY = this.panelY + 80;
        
        // Enter Orbit button
        if (this.currentZone.type === 'orbit' && this.currentZone.canEnter) {
            this.buttons.push({
                id: 'enter_orbit',
                label: 'ENTER ORBIT',
                x: this.panelX + 10,
                y: currentY,
                width: buttonWidth,
                height: buttonHeight,
                enabled: true,
                color: { r: 16, g: 48, b: 16 } // Dark green
            });
            currentY += buttonHeight + buttonSpacing;
        }
        
        // Land button
        if (this.currentZone.type === 'surface' && this.currentZone.canEnter) {
            this.buttons.push({
                id: 'land',
                label: 'LAND',
                x: this.panelX + 10,
                y: currentY,
                width: buttonWidth,
                height: buttonHeight,
                enabled: true,
                color: { r: 72, g: 48, b: 12 } // Dark amber
            });
            currentY += buttonHeight + buttonSpacing;
        }
        
        // Scan button (always available when close)
        this.buttons.push({
            id: 'scan',
            label: 'SCAN',
            x: this.panelX + 100,
            y: this.panelY + 80,
            width: buttonWidth,
            height: buttonHeight,
            enabled: true,
            color: { r: 16, g: 40, b: 32 } // Dark teal
        });
        
        // Mining button (if landed or in atmosphere)
        if (this.currentZone.type === 'surface' || this.currentZone.type === 'atmosphere') {
            if (this.currentBody.mineralDeposits.length > 0) {
                this.buttons.push({
                    id: 'mine',
                    label: 'MINE',
                    x: this.panelX + 100,
                    y: this.panelY + 110,
                    width: buttonWidth,
                    height: buttonHeight,
                    enabled: this.currentBody.resourcesDepleted < 0.9,
                    color: { r: 48, g: 32, b: 16 } // Dark orange
                });
            }
        }
        
        // Continue Flight button (always present)
        this.buttons.push({
            id: 'continue',
            label: 'CONTINUE',
            x: this.panelX + 10,
            y: this.panelY + this.panelHeight - 35,
            width: this.panelWidth - 20,
            height: buttonHeight,
            enabled: true,
            color: { r: 32, g: 32, b: 32 } // Gray
        });
    }

    /**
     * Update panel state
     */
    update(deltaTime: number, input: InputManager): void {
        if (!this.isVisible && this.targetOpacity === 0) return;
        
        // Update opacity animation
        if (this.config.enableAnimations) {
            if (this.opacity < this.targetOpacity) {
                this.opacity = Math.min(this.targetOpacity, this.opacity + this.config.fadeSpeed * deltaTime);
            } else if (this.opacity > this.targetOpacity) {
                this.opacity = Math.max(this.targetOpacity, this.opacity - this.config.fadeSpeed * deltaTime);
            }
        } else {
            this.opacity = this.targetOpacity;
        }
        
        // Handle input if visible
        if (this.isVisible && this.opacity > 0.5) {
            this.handleInput(input);
        }
    }

    /**
     * Handle user input
     */
    private handleInput(input: InputManager): void {
        const mousePos = input.getMousePosition();
        
        // Check for button hover
        this.hoveredButton = null;
        for (const button of this.buttons) {
            if (this.isPointInButton(mousePos, button)) {
                this.hoveredButton = button.id;
                break;
            }
        }
        
        // Handle button clicks
        if (input.isMouseButtonPressed(0) && this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton);
        }
        
        // Handle keyboard shortcuts
        if (input.isKeyPressed('KeyE')) {
            this.handleButtonClick('enter_orbit');
        } else if (input.isKeyPressed('KeyL')) {
            this.handleButtonClick('land');
        } else if (input.isKeyPressed('KeyS')) {
            this.handleButtonClick('scan');
        } else if (input.isKeyPressed('KeyM')) {
            this.handleButtonClick('mine');
        } else if (input.isKeyPressed('KeyC') || input.isKeyPressed('Escape')) {
            this.handleButtonClick('continue');
        }
    }

    /**
     * Check if point is inside button
     */
    private isPointInButton(point: Vector2, button: InteractionButton): boolean {
        return point.x >= button.x && 
               point.x <= button.x + button.width &&
               point.y >= button.y && 
               point.y <= button.y + button.height;
    }

    /**
     * Handle button clicks
     */
    private handleButtonClick(buttonId: string): void {
        if (!this.currentBody) return;
        
        const button = this.buttons.find(b => b.id === buttonId);
        if (!button || !button.enabled) return;
        
        switch (buttonId) {
            case 'enter_orbit':
                this.interactions.onEnterOrbit?.(this.currentBody.id);
                this.logger.info(`🛰️ Entering orbit around ${this.currentBody.name}`);
                this.hideInteraction();
                break;
                
            case 'land':
                this.interactions.onLand?.(this.currentBody.id);
                this.logger.info(`🚁 Landing on ${this.currentBody.name}`);
                this.hideInteraction();
                break;
                
            case 'scan':
                this.performScan();
                break;
                
            case 'mine':
                this.performMining();
                break;
                
            case 'continue':
                this.interactions.onContinueFlight?.();
                this.hideInteraction();
                break;
        }
    }

    /**
     * Perform scan operation
     */
    private performScan(): void {
        if (!this.currentBody) return;
        
        this.scanData = this.currentBody.performScan();
        this.currentBody.isDiscovered = true;
        
        this.interactions.onPerformScan?.(this.currentBody.id);
        
        this.logger.info(`🔍 Scanned ${this.currentBody.name}`, {
            composition: this.scanData.composition,
            biologicalSigns: this.scanData.biologicalSigns
        });
        
        // Refresh body info with scan data
        this.bodyInfo = this.currentBody.getInteractionInfo();
    }

    /**
     * Perform mining operation
     */
    private performMining(): void {
        if (!this.currentBody) return;
        
        const shipPosition = { x: 0, y: 0 }; // TODO: Get actual ship position
        const result = this.currentBody.performMining(shipPosition, 1.0);
        
        if (result) {
            this.miningResults.push(result);
            this.interactions.onStartMining?.(this.currentBody.id);
            
            this.logger.info(`⛏️ Mined ${result.quantity.toFixed(2)} ${result.resourceType}`, {
                quality: result.quality,
                depletion: result.depletion
            });
            
            // Update button state if resources depleted
            if (result.depletion > 0.9) {
                const mineButton = this.buttons.find(b => b.id === 'mine');
                if (mineButton) {
                    mineButton.enabled = false;
                    mineButton.color = { r: 24, g: 24, b: 24 }; // Disabled gray
                }
            }
        }
    }

    /**
     * Render the interaction panel
     */
    render(renderer: Renderer): void {
        if (!this.isVisible || this.opacity <= 0) return;
        
        // Apply opacity to all colors
        const alpha = this.opacity;
        
        // Render panel background (dark CRT monitor style)
        const bgColor = { 
            r: Math.floor(8 * alpha), 
            g: Math.floor(12 * alpha), 
            b: Math.floor(8 * alpha) 
        };
        renderer.fillRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, bgColor);
        
        // Panel border (dark green CRT glow)
        const borderColor = { 
            r: Math.floor(16 * alpha), 
            g: Math.floor(48 * alpha), 
            b: Math.floor(16 * alpha) 
        };
        this.renderPanelBorder(renderer, borderColor);
        
        // Panel title
        const titleColor = { 
            r: Math.floor(12 * alpha), 
            g: Math.floor(36 * alpha), 
            b: Math.floor(12 * alpha) 
        };
        renderer.renderText('PROXIMITY ALERT', this.panelX + 10, this.panelY + 10, titleColor, 10);
        
        // Body information
        if (this.bodyInfo) {
            this.renderBodyInfo(renderer, alpha);
        }
        
        // Scan data
        if (this.scanData) {
            this.renderScanData(renderer, alpha);
        }
        
        // Mining results
        if (this.miningResults.length > 0) {
            this.renderMiningResults(renderer, alpha);
        }
        
        // Render buttons
        this.renderButtons(renderer, alpha);
        
        // Render CRT effects
        this.renderCRTEffects(renderer, alpha);
    }

    /**
     * Render panel border with CRT styling
     */
    private renderPanelBorder(renderer: Renderer, color: Color): void {
        // Top and bottom borders
        renderer.fillRect(this.panelX, this.panelY, this.panelWidth, 2, color);
        renderer.fillRect(this.panelX, this.panelY + this.panelHeight - 2, this.panelWidth, 2, color);
        
        // Left and right borders
        renderer.fillRect(this.panelX, this.panelY, 2, this.panelHeight, color);
        renderer.fillRect(this.panelX + this.panelWidth - 2, this.panelY, 2, this.panelHeight, color);
        
        // Corner highlights
        const highlightColor = { r: color.r + 8, g: color.g + 8, b: color.b + 8 };
        renderer.fillRect(this.panelX, this.panelY, 8, 2, highlightColor);
        renderer.fillRect(this.panelX, this.panelY, 2, 8, highlightColor);
    }

    /**
     * Render body information
     */
    private renderBodyInfo(renderer: Renderer, alpha: number): void {
        const textColor = { 
            r: Math.floor(48 * alpha), 
            g: Math.floor(48 * alpha), 
            b: Math.floor(48 * alpha) 
        };
        
        const lines = this.bodyInfo.split('\n');
        let y = this.panelY + 30;
        
        lines.forEach(line => {
            renderer.renderText(line, this.panelX + 10, y, textColor, 8);
            y += 12;
        });
    }

    /**
     * Render scan data
     */
    private renderScanData(renderer: Renderer, alpha: number): void {
        if (!this.scanData) return;
        
        const textColor = { 
            r: Math.floor(32 * alpha), 
            g: Math.floor(80 * alpha), 
            b: Math.floor(64 * alpha) 
        };
        
        let y = this.panelY + 30;
        
        renderer.renderText(`COMP: ${this.scanData.composition.join(', ')}`, 
            this.panelX + 10, y, textColor, 7);
        y += 10;
        
        if (this.scanData.biologicalSigns) {
            renderer.renderText('BIO: DETECTED', this.panelX + 10, y, 
                { r: Math.floor(96 * alpha), g: Math.floor(64 * alpha), b: Math.floor(16 * alpha) }, 7);
            y += 10;
        }
        
        renderer.renderText(`MINERALS: ${this.scanData.mineralDeposits.length}`, 
            this.panelX + 10, y, textColor, 7);
    }

    /**
     * Render mining results
     */
    private renderMiningResults(renderer: Renderer, alpha: number): void {
        const textColor = { 
            r: Math.floor(96 * alpha), 
            g: Math.floor(64 * alpha), 
            b: Math.floor(16 * alpha) 
        };
        
        const lastResult = this.miningResults[this.miningResults.length - 1];
        const y = this.panelY + this.panelHeight - 60;
        
        renderer.renderText(`MINED: ${lastResult.quantity.toFixed(1)} ${lastResult.resourceType}`, 
            this.panelX + 10, y, textColor, 8);
    }

    /**
     * Render interactive buttons
     */
    private renderButtons(renderer: Renderer, alpha: number): void {
        this.buttons.forEach(button => {
            const isHovered = this.hoveredButton === button.id;
            const buttonAlpha = button.enabled ? alpha : alpha * 0.5;
            
            // Button background
            const bgColor = isHovered ? 
                { 
                    r: Math.floor((button.color.r + 16) * buttonAlpha), 
                    g: Math.floor((button.color.g + 16) * buttonAlpha), 
                    b: Math.floor((button.color.b + 16) * buttonAlpha) 
                } : 
                { 
                    r: Math.floor(button.color.r * buttonAlpha), 
                    g: Math.floor(button.color.g * buttonAlpha), 
                    b: Math.floor(button.color.b * buttonAlpha) 
                };
            
            renderer.fillRect(button.x, button.y, button.width, button.height, bgColor);
            
            // Button border
            const borderColor = { 
                r: Math.floor((button.color.r + 32) * buttonAlpha), 
                g: Math.floor((button.color.g + 32) * buttonAlpha), 
                b: Math.floor((button.color.b + 32) * buttonAlpha) 
            };
            renderer.drawLine(button.x, button.y, button.x + button.width, button.y, borderColor);
            renderer.drawLine(button.x, button.y, button.x, button.y + button.height, borderColor);
            
            // Button text
            const textColor = button.enabled ? 
                { 
                    r: Math.floor(64 * alpha), 
                    g: Math.floor(64 * alpha), 
                    b: Math.floor(64 * alpha) 
                } : 
                { 
                    r: Math.floor(32 * alpha), 
                    g: Math.floor(32 * alpha), 
                    b: Math.floor(32 * alpha) 
                };
            
            const textX = button.x + (button.width - button.label.length * 6) / 2;
            const textY = button.y + (button.height - 8) / 2;
            renderer.renderText(button.label, textX, textY, textColor, 8);
        });
    }

    /**
     * Render CRT effects
     */
    private renderCRTEffects(renderer: Renderer, alpha: number): void {
        // Subtle scanline effect across the panel
        for (let y = this.panelY; y < this.panelY + this.panelHeight; y += 4) {
            const scanlineColor = { 
                r: Math.floor(4 * alpha), 
                g: Math.floor(8 * alpha), 
                b: Math.floor(4 * alpha) 
            };
            renderer.fillRect(this.panelX, y, this.panelWidth, 1, scanlineColor);
        }
    }

    /**
     * Check if panel is currently visible
     */
    isInteractionVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Get current interaction body
     */
    getCurrentBody(): CelestialBody | null {
        return this.currentBody;
    }
}