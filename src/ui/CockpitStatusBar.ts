/**
 * Retro Cockpit Status Bar
 * 5-panel status bar with CRT monitor styling and interactive controls
 */

import { Renderer, Color } from '@core/Renderer';
import { InputManager } from '@core/InputManager';
import { SystemStatus, PowerAllocation, DamageReport, ShipSection } from '@entities/ShipSystems';
import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';

export interface StatusBarConfig {
    screenWidth: number;
    screenHeight: number;
    panelHeight: number;
    panelSpacing: number;
    enableInteraction: boolean;
    crtEffects: boolean;
}

export interface PanelInteraction {
    onPowerAllocationChange?: (allocation: Partial<PowerAllocation>) => void;
    onSystemToggle?: (system: string, state: boolean) => void;
    onRepairRequest?: (section: ShipSection, damageIndex: number) => void;
    onInventoryOpen?: () => void;
    onCodexOpen?: () => void;
    onResearchOpen?: () => void;
    onCrewOpen?: () => void;
    onRadarZoom?: (zoomLevel: number) => void;
    onGalaxyMapOpen?: () => void;
}

interface PanelArea {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
}

interface InteractiveElement {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'button' | 'slider' | 'toggle' | 'monitor';
    id: string;
    value?: number; // For sliders
    state?: boolean; // For toggles
    label: string;
}

export class CockpitStatusBar {
    private config: StatusBarConfig;
    private panels: PanelArea[] = [];
    private interactiveElements: Map<string, InteractiveElement> = new Map();
    private interactions: PanelInteraction;
    
    // Visual state
    private flickerTimer = 0;
    private scanlineOffset = 0;
    private glitchTimer = 0;
    
    // Input handling
    private hoveredElement: string | null = null;
    private selectedElement: string | null = null;
    private isDragging = false;
    
    // Data display
    private systemStatus: SystemStatus;
    private damageReports: Map<ShipSection, DamageReport[]> = new Map();
    private cargoLoad = 0;
    private radarZoom = 1.0;
    private radarMode: 'system' | 'interstellar' = 'system';
    
    private logger: Logger;

    constructor(
        config: Partial<StatusBarConfig> = {},
        interactions: PanelInteraction = {}
    ) {
        this.logger = new Logger('CockpitStatusBar');
        this.interactions = interactions;
        
        // Default configuration
        this.config = {
            screenWidth: 1024,
            screenHeight: 768,
            panelHeight: 115, // 15% of 768px
            panelSpacing: 5,
            enableInteraction: true,
            crtEffects: true,
            ...config
        };
        
        // Initialize default system status
        this.systemStatus = {
            hull: 100,
            shields: 100,
            power: 100,
            fuel: 100,
            heat: 0,
            enginesOnline: true,
            shieldsOnline: true,
            weaponsOnline: true,
            lifeSupport: true,
            warpDrive: true,
            engineEfficiency: 1.0,
            shieldStrength: 1.0,
            weaponAccuracy: 1.0,
            sensorRange: 1.0
        };
        
        this.setupPanels();
        this.setupInteractiveElements();
        
        this.logger.info('🖥️ Cockpit status bar initialized', {
            panels: this.panels.length,
            interactiveElements: this.interactiveElements.size
        });
    }

    /**
     * Setup the 5 main panels
     */
    private setupPanels(): void {
        const totalWidth = this.config.screenWidth;
        const panelWidth = (totalWidth - (this.config.panelSpacing * 6)) / 5;
        const startY = this.config.screenHeight - this.config.panelHeight;
        
        this.panels = [
            {
                x: this.config.panelSpacing,
                y: startY,
                width: panelWidth,
                height: this.config.panelHeight,
                title: 'SHIP SYSTEMS'
            },
            {
                x: this.config.panelSpacing + (panelWidth + this.config.panelSpacing) * 1,
                y: startY,
                width: panelWidth,
                height: this.config.panelHeight,
                title: 'SHIP CONTROL'
            },
            {
                x: this.config.panelSpacing + (panelWidth + this.config.panelSpacing) * 2,
                y: startY,
                width: panelWidth,
                height: this.config.panelHeight,
                title: 'DAMAGE & CARGO'
            },
            {
                x: this.config.panelSpacing + (panelWidth + this.config.panelSpacing) * 3,
                y: startY,
                width: panelWidth,
                height: this.config.panelHeight,
                title: 'WEAPONS'
            },
            {
                x: this.config.panelSpacing + (panelWidth + this.config.panelSpacing) * 4,
                y: startY,
                width: panelWidth,
                height: this.config.panelHeight,
                title: 'RADAR & NAV'
            }
        ];
    }

    /**
     * Setup interactive elements for each panel
     */
    private setupInteractiveElements(): void {
        this.setupSystemsPanel();
        this.setupControlPanel();
        this.setupDamagePanel();
        this.setupWeaponsPanel();
        this.setupRadarPanel();
    }

    /**
     * Setup ship systems panel (Panel 1)
     */
    private setupSystemsPanel(): void {
        const panel = this.panels[0];
        const elementWidth = 25;
        const elementHeight = 8;
        
        // Status indicators
        this.addElement('hull_indicator', panel.x + 10, panel.y + 20, elementWidth, elementHeight, 'monitor', 'HULL');
        this.addElement('shields_indicator', panel.x + 10, panel.y + 35, elementWidth, elementHeight, 'monitor', 'SHIELDS');
        this.addElement('power_indicator', panel.x + 10, panel.y + 50, elementWidth, elementHeight, 'monitor', 'POWER');
        this.addElement('fuel_indicator', panel.x + 10, panel.y + 65, elementWidth, elementHeight, 'monitor', 'FUEL');
        this.addElement('heat_indicator', panel.x + 10, panel.y + 80, elementWidth, elementHeight, 'monitor', 'HEAT');
        
        // Critical warning lights
        this.addElement('reactor_warning', panel.x + 80, panel.y + 20, 12, 12, 'button', 'RCTR');
        this.addElement('hull_warning', panel.x + 80, panel.y + 35, 12, 12, 'button', 'HULL');
        this.addElement('shield_warning', panel.x + 80, panel.y + 50, 12, 12, 'button', 'SHLD');
        this.addElement('warp_warning', panel.x + 80, panel.y + 65, 12, 12, 'button', 'WARP');
    }

    /**
     * Setup ship control panel (Panel 2)
     */
    private setupControlPanel(): void {
        const panel = this.panels[1];
        
        // System toggles
        this.addElement('engines_toggle', panel.x + 10, panel.y + 20, 30, 15, 'toggle', 'ENGINES');
        this.addElement('shields_toggle', panel.x + 50, panel.y + 20, 30, 15, 'toggle', 'SHIELDS');
        this.addElement('weapons_toggle', panel.x + 90, panel.y + 20, 30, 15, 'toggle', 'WEAPONS');
        this.addElement('warp_toggle', panel.x + 130, panel.y + 20, 30, 15, 'toggle', 'WARP');
        
        // Power sliders
        this.addElement('thrust_slider', panel.x + 10, panel.y + 45, 60, 10, 'slider', 'THRUST');
        this.addElement('shield_slider', panel.x + 80, panel.y + 45, 60, 10, 'slider', 'SHIELDS');
        
        // Emergency button
        this.addElement('autodestruct', panel.x + 60, panel.y + 70, 40, 20, 'button', 'AUTO-DESTRUCT');
    }

    /**
     * Setup damage and cargo panel (Panel 3)
     */
    private setupDamagePanel(): void {
        const panel = this.panels[2];
        
        // Damage monitor (central area)
        this.addElement('damage_monitor', panel.x + 10, panel.y + 20, 80, 50, 'monitor', 'DAMAGE');
        
        // Cargo load indicator
        this.addElement('cargo_indicator', panel.x + 100, panel.y + 20, 60, 15, 'monitor', 'CARGO');
        
        // Interface buttons
        this.addElement('inventory_btn', panel.x + 10, panel.y + 80, 35, 15, 'button', 'INV');
        this.addElement('codex_btn', panel.x + 50, panel.y + 80, 35, 15, 'button', 'CODEX');
        this.addElement('research_btn', panel.x + 90, panel.y + 80, 35, 15, 'button', 'RSCH');
        this.addElement('crew_btn', panel.x + 130, panel.y + 80, 35, 15, 'button', 'CREW');
    }

    /**
     * Setup weapons panel (Panel 4)
     */
    private setupWeaponsPanel(): void {
        const panel = this.panels[3];
        
        // Weapon selection
        this.addElement('weapon1_btn', panel.x + 10, panel.y + 20, 40, 15, 'button', 'LASER');
        this.addElement('weapon2_btn', panel.x + 55, panel.y + 20, 40, 15, 'button', 'PLASMA');
        this.addElement('weapon3_btn', panel.x + 100, panel.y + 20, 40, 15, 'button', 'MISSILE');
        
        // Weapon info monitor
        this.addElement('weapon_monitor', panel.x + 10, panel.y + 40, 130, 25, 'monitor', 'WEAPON INFO');
        
        // Warning lights
        this.addElement('overheat_warning', panel.x + 10, panel.y + 75, 15, 15, 'button', 'HOT');
        this.addElement('ammo_warning', panel.x + 30, panel.y + 75, 15, 15, 'button', 'AMMO');
        this.addElement('energy_warning', panel.x + 50, panel.y + 75, 15, 15, 'button', 'PWR');
    }

    /**
     * Setup radar and navigation panel (Panel 5)
     */
    private setupRadarPanel(): void {
        const panel = this.panels[4];
        
        // Radar display
        this.addElement('radar_display', panel.x + 10, panel.y + 20, 80, 50, 'monitor', 'RADAR');
        
        // Radar controls
        this.addElement('zoom_in', panel.x + 100, panel.y + 20, 20, 15, 'button', 'Z+');
        this.addElement('zoom_out', panel.x + 125, panel.y + 20, 20, 15, 'button', 'Z-');
        this.addElement('radar_mode', panel.x + 100, panel.y + 40, 45, 15, 'toggle', 'MODE');
        this.addElement('galaxy_map', panel.x + 100, panel.y + 60, 45, 15, 'button', 'GALAXY');
    }

    /**
     * Add interactive element
     */
    private addElement(
        id: string, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        type: 'button' | 'slider' | 'toggle' | 'monitor',
        label: string
    ): void {
        this.interactiveElements.set(id, {
            x, y, width, height, type, id, label,
            value: type === 'slider' ? 50 : undefined,
            state: type === 'toggle' ? true : undefined
        });
    }

    /**
     * Update status bar (called each frame)
     */
    update(deltaTime: number, input: InputManager): void {
        // Update visual effects
        this.updateVisualEffects(deltaTime);
        
        // Handle input if interaction is enabled
        if (this.config.enableInteraction) {
            this.handleInput(input);
        }
    }

    /**
     * Update visual effects (flicker, scanlines, glitch)
     */
    private updateVisualEffects(deltaTime: number): void {
        this.flickerTimer += deltaTime;
        this.scanlineOffset += deltaTime * 100; // Scanline speed
        this.glitchTimer += deltaTime;
        
        // Reset timers to prevent overflow
        if (this.flickerTimer > 10) this.flickerTimer = 0;
        if (this.scanlineOffset > 1000) this.scanlineOffset = 0;
        if (this.glitchTimer > 5) this.glitchTimer = 0;
    }

    /**
     * Handle user input
     */
    private handleInput(input: InputManager): void {
        const mousePos = input.getMousePosition();
        
        // Check for element hover
        this.hoveredElement = null;
        for (const [id, element] of this.interactiveElements) {
            if (this.isPointInElement(mousePos, element)) {
                this.hoveredElement = id;
                break;
            }
        }
        
        // Handle clicks
        if (input.isMouseButtonPressed(0)) {
            if (this.hoveredElement) {
                this.handleElementClick(this.hoveredElement);
            }
        }
        
        // Handle dragging for sliders
        if (input.isMouseButtonDown(0) && this.selectedElement) {
            const element = this.interactiveElements.get(this.selectedElement);
            if (element && element.type === 'slider') {
                this.handleSliderDrag(element, mousePos);
            }
        } else {
            this.selectedElement = null;
            this.isDragging = false;
        }
    }

    /**
     * Check if point is inside element
     */
    private isPointInElement(point: Vector2, element: InteractiveElement): boolean {
        return point.x >= element.x && 
               point.x <= element.x + element.width &&
               point.y >= element.y && 
               point.y <= element.y + element.height;
    }

    /**
     * Handle element click
     */
    private handleElementClick(elementId: string): void {
        const element = this.interactiveElements.get(elementId);
        if (!element) return;
        
        this.selectedElement = elementId;
        
        switch (element.type) {
            case 'button':
                this.handleButtonClick(elementId);
                break;
            case 'toggle':
                this.handleToggleClick(elementId, element);
                break;
            case 'slider':
                this.isDragging = true;
                break;
        }
    }

    /**
     * Handle button clicks
     */
    private handleButtonClick(elementId: string): void {
        switch (elementId) {
            case 'autodestruct':
                // Confirmation would be needed
                this.logger.warn('🛑 Auto-destruct sequence requested');
                break;
            case 'inventory_btn':
                this.interactions.onInventoryOpen?.();
                break;
            case 'codex_btn':
                this.interactions.onCodexOpen?.();
                break;
            case 'research_btn':
                this.interactions.onResearchOpen?.();
                break;
            case 'crew_btn':
                this.interactions.onCrewOpen?.();
                break;
            case 'galaxy_map':
                this.interactions.onGalaxyMapOpen?.();
                break;
            case 'zoom_in':
                this.radarZoom = Math.min(5.0, this.radarZoom * 1.5);
                this.interactions.onRadarZoom?.(this.radarZoom);
                break;
            case 'zoom_out':
                this.radarZoom = Math.max(0.2, this.radarZoom / 1.5);
                this.interactions.onRadarZoom?.(this.radarZoom);
                break;
        }
    }

    /**
     * Handle toggle clicks
     */
    private handleToggleClick(elementId: string, element: InteractiveElement): void {
        element.state = !element.state;
        
        const systemMap: Record<string, string> = {
            'engines_toggle': 'engines',
            'shields_toggle': 'shields',
            'weapons_toggle': 'weapons',
            'warp_toggle': 'warp_drive',
            'radar_mode': 'radar_mode'
        };
        
        const systemName = systemMap[elementId];
        if (systemName) {
            if (systemName === 'radar_mode') {
                this.radarMode = this.radarMode === 'system' ? 'interstellar' : 'system';
            } else {
                this.interactions.onSystemToggle?.(systemName, element.state!);
            }
        }
    }

    /**
     * Handle slider dragging
     */
    private handleSliderDrag(element: InteractiveElement, mousePos: Vector2): void {
        const localX = mousePos.x - element.x;
        const percentage = Math.max(0, Math.min(100, (localX / element.width) * 100));
        element.value = percentage;
        
        // Update power allocation
        if (element.id === 'thrust_slider') {
            this.interactions.onPowerAllocationChange?.({ engines: percentage });
        } else if (element.id === 'shield_slider') {
            this.interactions.onPowerAllocationChange?.({ shields: percentage });
        }
    }

    /**
     * Render the status bar
     */
    render(renderer: Renderer): void {
        // Render background base
        this.renderPanelBase(renderer);
        
        // Render each panel
        this.panels.forEach((panel, index) => {
            this.renderPanel(renderer, panel, index);
        });
        
        // Render CRT effects if enabled
        if (this.config.crtEffects) {
            this.renderCRTEffects(renderer);
        }
    }

    /**
     * Render panel base structure
     */
    private renderPanelBase(renderer: Renderer): void {
        const baseY = this.config.screenHeight - this.config.panelHeight - 10;
        const baseHeight = this.config.panelHeight + 20;
        
        // Main base panel
        renderer.fillRect(0, baseY, this.config.screenWidth, baseHeight, { r: 20, g: 25, b: 30 });
        
        // Decorative edge
        renderer.fillRect(0, baseY, this.config.screenWidth, 3, { r: 0, g: 64, b: 32 });
        
        // Panel separators
        for (let i = 1; i < this.panels.length; i++) {
            const x = this.panels[i].x - this.config.panelSpacing / 2;
            renderer.fillRect(x, baseY + 5, 1, baseHeight - 10, { r: 0, g: 128, b: 64 });
        }
    }

    /**
     * Render individual panel
     */
    private renderPanel(renderer: Renderer, panel: PanelArea, panelIndex: number): void {
        // Panel background with depth effect
        renderer.fillRect(panel.x, panel.y, panel.width, panel.height, { r: 15, g: 20, b: 25 });
        renderer.drawLine(panel.x, panel.y, panel.x + panel.width, panel.y, { r: 0, g: 255, b: 128 });
        renderer.drawLine(panel.x, panel.y, panel.x, panel.y + panel.height, { r: 0, g: 255, b: 128 });
        
        // Panel title
        renderer.renderText(panel.title, panel.x + 5, panel.y + 5, { r: 0, g: 255, b: 0 }, 8);
        
        // Render panel content based on index
        switch (panelIndex) {
            case 0: this.renderSystemsPanel(renderer, panel); break;
            case 1: this.renderControlPanel(renderer, panel); break;
            case 2: this.renderDamagePanel(renderer, panel); break;
            case 3: this.renderWeaponsPanel(renderer, panel); break;
            case 4: this.renderRadarPanel(renderer, panel); break;
        }
    }

    /**
     * Render systems panel content
     */
    private renderSystemsPanel(renderer: Renderer, panel: PanelArea): void {
        // Status bars
        this.renderStatusBar(renderer, panel.x + 40, panel.y + 20, 30, 8, this.systemStatus.hull, 'HULL');
        this.renderStatusBar(renderer, panel.x + 40, panel.y + 35, 30, 8, this.systemStatus.shields, 'SHLD');
        this.renderStatusBar(renderer, panel.x + 40, panel.y + 50, 30, 8, this.systemStatus.power, 'PWR');
        this.renderStatusBar(renderer, panel.x + 40, panel.y + 65, 30, 8, this.systemStatus.fuel, 'FUEL');
        this.renderStatusBar(renderer, panel.x + 40, panel.y + 80, 30, 8, this.systemStatus.heat, 'HEAT', true);
        
        // Warning lights
        this.renderWarningLight(renderer, panel.x + 95, panel.y + 20, this.systemStatus.power < 30);
        this.renderWarningLight(renderer, panel.x + 95, panel.y + 35, this.systemStatus.hull < 25);
        this.renderWarningLight(renderer, panel.x + 95, panel.y + 50, !this.systemStatus.shieldsOnline);
        this.renderWarningLight(renderer, panel.x + 95, panel.y + 65, !this.systemStatus.warpDrive);
    }

    /**
     * Render control panel content
     */
    private renderControlPanel(renderer: Renderer, panel: PanelArea): void {
        // System toggles
        this.renderToggle(renderer, panel.x + 10, panel.y + 20, 30, 15, this.systemStatus.enginesOnline, 'ENG');
        this.renderToggle(renderer, panel.x + 50, panel.y + 20, 30, 15, this.systemStatus.shieldsOnline, 'SHLD');
        this.renderToggle(renderer, panel.x + 90, panel.y + 20, 30, 15, this.systemStatus.weaponsOnline, 'WPN');
        this.renderToggle(renderer, panel.x + 130, panel.y + 20, 30, 15, this.systemStatus.warpDrive, 'WARP');
        
        // Power sliders
        const thrustSlider = this.interactiveElements.get('thrust_slider');
        const shieldSlider = this.interactiveElements.get('shield_slider');
        
        if (thrustSlider) {
            this.renderSlider(renderer, thrustSlider, thrustSlider.value || 50, 'THRUST');
        }
        if (shieldSlider) {
            this.renderSlider(renderer, shieldSlider, shieldSlider.value || 50, 'SHIELDS');
        }
        
        // Emergency button
        this.renderButton(renderer, panel.x + 60, panel.y + 70, 40, 20, 'DESTRUCT', { r: 200, g: 0, b: 0 });
    }

    /**
     * Render damage panel content
     */
    private renderDamagePanel(renderer: Renderer, panel: PanelArea): void {
        // Damage monitor
        this.renderDamageDisplay(renderer, panel.x + 10, panel.y + 20, 80, 50);
        
        // Cargo indicator
        renderer.renderText(`CARGO: ${this.cargoLoad.toFixed(0)}%`, 
            panel.x + 100, panel.y + 25, { r: 255, g: 255, b: 0 }, 10);
        
        // Interface buttons
        this.renderButton(renderer, panel.x + 10, panel.y + 80, 35, 15, 'INV', { r: 0, g: 192, b: 255 });
        this.renderButton(renderer, panel.x + 50, panel.y + 80, 35, 15, 'CODEX', { r: 0, g: 192, b: 255 });
        this.renderButton(renderer, panel.x + 90, panel.y + 80, 35, 15, 'RSCH', { r: 0, g: 192, b: 255 });
        this.renderButton(renderer, panel.x + 130, panel.y + 80, 35, 15, 'CREW', { r: 0, g: 192, b: 255 });
    }

    /**
     * Render weapons panel content
     */
    private renderWeaponsPanel(renderer: Renderer, panel: PanelArea): void {
        // Weapon selection buttons
        this.renderButton(renderer, panel.x + 10, panel.y + 20, 40, 15, 'LASER', { r: 0, g: 255, b: 0 });
        this.renderButton(renderer, panel.x + 55, panel.y + 20, 40, 15, 'PLASMA', { r: 128, g: 128, b: 128 });
        this.renderButton(renderer, panel.x + 100, panel.y + 20, 40, 15, 'MISSILE', { r: 128, g: 128, b: 128 });
        
        // Weapon info display
        renderer.fillRect(panel.x + 10, panel.y + 40, 130, 25, { r: 5, g: 10, b: 5 });
        renderer.renderText('LASER CANNON MK-II', panel.x + 15, panel.y + 45, { r: 0, g: 255, b: 0 }, 8);
        renderer.renderText('PWR: 85% RNG: 2.5KM', panel.x + 15, panel.y + 55, { r: 0, g: 192, b: 0 }, 8);
        
        // Warning lights
        this.renderWarningLight(renderer, panel.x + 15, panel.y + 75, this.systemStatus.heat > 80);
        this.renderWarningLight(renderer, panel.x + 35, panel.y + 75, false); // Ammo OK
        this.renderWarningLight(renderer, panel.x + 55, panel.y + 75, this.systemStatus.power < 20);
    }

    /**
     * Render radar panel content
     */
    private renderRadarPanel(renderer: Renderer, panel: PanelArea): void {
        // Radar display
        this.renderRadarDisplay(renderer, panel.x + 10, panel.y + 20, 80, 50);
        
        // Control buttons
        this.renderButton(renderer, panel.x + 100, panel.y + 20, 20, 15, 'Z+', { r: 0, g: 128, b: 255 });
        this.renderButton(renderer, panel.x + 125, panel.y + 20, 20, 15, 'Z-', { r: 0, g: 128, b: 255 });
        this.renderToggle(renderer, panel.x + 100, panel.y + 40, 45, 15, this.radarMode === 'interstellar', 'MODE');
        this.renderButton(renderer, panel.x + 100, panel.y + 60, 45, 15, 'GALAXY', { r: 255, g: 165, b: 0 });
    }

    /**
     * Render status bar
     */
    private renderStatusBar(
        renderer: Renderer, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        value: number, 
        label: string,
        isHeat = false
    ): void {
        // Background
        renderer.fillRect(x, y, width, height, { r: 5, g: 5, b: 5 });
        
        // Fill bar
        const fillWidth = (value / 100) * width;
        let fillColor: Color;
        
        if (isHeat) {
            // Heat bar (red when high)
            fillColor = value > 70 ? { r: 255, g: 0, b: 0 } : 
                       value > 40 ? { r: 255, g: 255, b: 0 } : 
                                   { r: 0, g: 255, b: 0 };
        } else {
            // Standard bar (green to red)
            fillColor = value > 60 ? { r: 0, g: 255, b: 0 } : 
                       value > 30 ? { r: 255, g: 255, b: 0 } : 
                                   { r: 255, g: 0, b: 0 };
        }
        
        renderer.fillRect(x, y, fillWidth, height, fillColor);
        
        // Border
        renderer.drawLine(x, y, x + width, y, { r: 128, g: 128, b: 128 });
        renderer.drawLine(x, y + height, x + width, y + height, { r: 128, g: 128, b: 128 });
        
        // Value text
        renderer.renderText(`${value.toFixed(0)}`, x + width + 2, y, { r: 255, g: 255, b: 255 }, 8);
    }

    /**
     * Render warning light
     */
    private renderWarningLight(renderer: Renderer, x: number, y: number, isActive: boolean): void {
        const color = isActive ? 
            { r: 255, g: 0, b: 0 } : 
            { r: 64, g: 0, b: 0 };
        
        renderer.fillRect(x, y, 8, 8, color);
        
        // Flicker effect for active warnings
        if (isActive && Math.sin(this.flickerTimer * 10) > 0.5) {
            renderer.fillRect(x + 1, y + 1, 6, 6, { r: 255, g: 64, b: 64 });
        }
    }

    /**
     * Render toggle switch
     */
    private renderToggle(
        renderer: Renderer, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        state: boolean, 
        label: string
    ): void {
        const bgColor = state ? { r: 0, g: 64, b: 0 } : { r: 64, g: 0, b: 0 };
        const textColor = state ? { r: 0, g: 255, b: 0 } : { r: 128, g: 128, b: 128 };
        
        renderer.fillRect(x, y, width, height, bgColor);
        renderer.renderText(label, x + 2, y + 4, textColor, 8);
    }

    /**
     * Render slider
     */
    private renderSlider(
        renderer: Renderer, 
        element: InteractiveElement, 
        value: number, 
        label: string
    ): void {
        // Background
        renderer.fillRect(element.x, element.y, element.width, element.height, { r: 20, g: 20, b: 20 });
        
        // Slider position
        const sliderPos = (value / 100) * element.width;
        renderer.fillRect(element.x, element.y, sliderPos, element.height, { r: 0, g: 128, b: 255 });
        
        // Slider handle
        renderer.fillRect(element.x + sliderPos - 2, element.y - 2, 4, element.height + 4, { r: 255, g: 255, b: 255 });
        
        // Label and value
        renderer.renderText(label, element.x, element.y - 12, { r: 255, g: 255, b: 255 }, 8);
        renderer.renderText(`${value.toFixed(0)}%`, element.x + element.width - 25, element.y - 12, { r: 255, g: 255, b: 255 }, 8);
    }

    /**
     * Render button
     */
    private renderButton(
        renderer: Renderer, 
        x: number, 
        y: number, 
        width: number, 
        height: number, 
        label: string, 
        color: Color
    ): void {
        const isHovered = this.hoveredElement?.includes(label.toLowerCase());
        const bgColor = isHovered ? 
            { r: color.r + 30, g: color.g + 30, b: color.b + 30 } : 
            { r: color.r / 3, g: color.g / 3, b: color.b / 3 };
        
        renderer.fillRect(x, y, width, height, bgColor);
        renderer.renderText(label, x + 2, y + 3, color, 8);
    }

    /**
     * Render damage display
     */
    private renderDamageDisplay(renderer: Renderer, x: number, y: number, width: number, height: number): void {
        // Background
        renderer.fillRect(x, y, width, height, { r: 5, g: 10, b: 5 });
        
        // Ship schematic (simplified)
        const shipX = x + width / 2;
        const shipY = y + height / 2;
        
        // Draw 8 sections of the ship
        const sections = [
            { name: 'BOW', x: shipX, y: shipY - 15, color: { r: 0, g: 255, b: 0 } },
            { name: 'STERN', x: shipX, y: shipY + 15, color: { r: 0, g: 255, b: 0 } },
            { name: 'PORT', x: shipX - 15, y: shipY, color: { r: 0, g: 255, b: 0 } },
            { name: 'STBD', x: shipX + 15, y: shipY, color: { r: 0, g: 255, b: 0 } },
            { name: 'CORE', x: shipX, y: shipY, color: { r: 0, g: 255, b: 0 } },
            { name: 'BRDG', x: shipX - 8, y: shipY - 8, color: { r: 0, g: 255, b: 0 } },
            { name: 'ENG', x: shipX + 8, y: shipY + 8, color: { r: 0, g: 255, b: 0 } },
            { name: 'WPN', x: shipX + 8, y: shipY - 8, color: { r: 0, g: 255, b: 0 } }
        ];
        
        sections.forEach(section => {
            renderer.fillRect(section.x - 4, section.y - 4, 8, 8, section.color);
            renderer.renderText(section.name, section.x - 12, section.y + 8, { r: 0, g: 192, b: 0 }, 6);
        });
    }

    /**
     * Render radar display
     */
    private renderRadarDisplay(renderer: Renderer, x: number, y: number, width: number, height: number): void {
        // Background
        renderer.fillRect(x, y, width, height, { r: 0, g: 8, b: 0 });
        
        // Radar grid
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const maxRadius = Math.min(width, height) / 2 - 5;
        
        // Range rings
        for (let i = 1; i <= 3; i++) {
            const radius = (maxRadius / 3) * i;
            renderer.drawCircle(centerX, centerY, radius, { r: 0, g: 64, b: 0 });
        }
        
        // Cross hairs
        renderer.drawLine(centerX - maxRadius, centerY, centerX + maxRadius, centerY, { r: 0, g: 64, b: 0 });
        renderer.drawLine(centerX, centerY - maxRadius, centerX, centerY + maxRadius, { r: 0, g: 64, b: 0 });
        
        // Player ship (center)
        renderer.fillRect(centerX - 1, centerY - 1, 3, 3, { r: 0, g: 255, b: 0 });
        
        // Sample contacts
        renderer.fillRect(centerX + 10, centerY - 15, 2, 2, { r: 255, g: 255, b: 0 }); // Planet
        renderer.fillRect(centerX - 20, centerY + 8, 2, 2, { r: 255, g: 255, b: 0 }); // Planet
        
        // Mode indicator
        renderer.renderText(this.radarMode.toUpperCase(), x + 2, y + height - 12, { r: 0, g: 255, b: 0 }, 8);
        renderer.renderText(`ZOOM: ${this.radarZoom.toFixed(1)}x`, x + 2, y + height - 22, { r: 0, g: 255, b: 0 }, 8);
    }

    /**
     * Render CRT effects
     */
    private renderCRTEffects(renderer: Renderer): void {
        // Scanlines are handled by CSS in the main HTML
        // Additional flicker effect for damaged systems
        if (this.systemStatus.hull < 50 || this.systemStatus.power < 30) {
            // Add random glitch pixels
            if (Math.random() < 0.1) {
                const x = Math.random() * this.config.screenWidth;
                const y = this.config.screenHeight - this.config.panelHeight + Math.random() * this.config.panelHeight;
                renderer.setPixel(x, y, { r: 255, g: 255, b: 255 });
            }
        }
    }

    /**
     * Update system status
     */
    updateSystemStatus(status: SystemStatus): void {
        this.systemStatus = { ...status };
    }

    /**
     * Update damage reports
     */
    updateDamageReports(reports: Map<ShipSection, DamageReport[]>): void {
        this.damageReports = new Map(reports);
    }

    /**
     * Update cargo load
     */
    updateCargoLoad(load: number): void {
        this.cargoLoad = Math.max(0, Math.min(100, load));
    }

    /**
     * Get current power allocation from sliders
     */
    getPowerAllocation(): PowerAllocation {
        const thrustSlider = this.interactiveElements.get('thrust_slider');
        const shieldSlider = this.interactiveElements.get('shield_slider');
        
        return {
            engines: thrustSlider?.value || 30,
            shields: shieldSlider?.value || 25,
            weapons: 20,
            lifeSupport: 15,
            sensors: 10
        };
    }
}