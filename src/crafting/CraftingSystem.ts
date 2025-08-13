/**
 * Crafting System
 * Basic crafting mechanics for combining items into new ones
 */

import { Logger } from '@utils/Logger';
import { GameItem, ItemDatabase, ItemRecipe, ItemType, ItemRarity } from '@items/ItemSystem';
import { InventoryManager } from '@inventory/InventoryManager';
import { Renderer, Color } from '@core/Renderer';

export interface CraftingStation {
    id: string;
    name: string;
    type: 'basic' | 'advanced' | 'industrial';
    availableRecipes: string[]; // Recipe IDs
    energyRequired: number;
    isActive: boolean;
}

export interface CraftingAttempt {
    recipeId: string;
    station: CraftingStation;
    startTime: number;
    duration: number;
    energyCost: number;
    successRate: number;
}

export interface CraftingEvents {
    onCraftingStarted?: (attempt: CraftingAttempt) => void;
    onCraftingCompleted?: (item: GameItem, success: boolean) => void;
    onCraftingFailed?: (reason: string) => void;
}

export class CraftingSystem {
    private itemDatabase: ItemDatabase;
    private inventory: InventoryManager;
    private events: CraftingEvents;
    
    // Crafting state
    private stations: Map<string, CraftingStation> = new Map();
    private activeAttempts: CraftingAttempt[] = [];
    private knownRecipes: Set<string> = new Set();
    
    // UI state
    private isVisible: boolean = false;
    private selectedStation: string | null = null;
    private selectedRecipe: string | null = null;
    
    private logger: Logger;

    constructor(
        itemDatabase: ItemDatabase,
        inventory: InventoryManager,
        events: CraftingEvents = {}
    ) {
        this.logger = new Logger('CraftingSystem');
        this.itemDatabase = itemDatabase;
        this.inventory = inventory;
        this.events = events;
        
        this.initializeStations();
        this.initializeBasicRecipes();
        
        this.logger.info('🔧 Crafting system initialized', {
            stations: this.stations.size,
            knownRecipes: this.knownRecipes.size
        });
    }

    /**
     * Initialize crafting stations
     */
    private initializeStations(): void {
        const stations: CraftingStation[] = [
            {
                id: 'basic_fabricator',
                name: 'Basic Fabricator',
                type: 'basic',
                availableRecipes: [],
                energyRequired: 10,
                isActive: true
            },
            {
                id: 'advanced_forge',
                name: 'Advanced Forge',
                type: 'advanced',
                availableRecipes: [],
                energyRequired: 25,
                isActive: true
            },
            {
                id: 'industrial_plant',
                name: 'Industrial Plant',
                type: 'industrial',
                availableRecipes: [],
                energyRequired: 50,
                isActive: false // Requires research to unlock
            }
        ];
        
        stations.forEach(station => {
            this.stations.set(station.id, station);
        });
    }

    /**
     * Initialize basic crafting recipes
     */
    private initializeBasicRecipes(): void {
        // Create some basic recipes
        const basicRecipes: ItemRecipe[] = [
            {
                id: 'craft_circuit_from_metal',
                requiredItems: {
                    'metal_iron': 2,
                    'crystal_quartz': 1
                },
                craftingTime: 5, // 5 seconds
                energyCost: 10,
                successRate: 0.9
            },
            {
                id: 'craft_repair_kit',
                requiredItems: {
                    'metal_iron': 1,
                    'comp_circuit': 1
                },
                craftingTime: 8,
                energyCost: 15,
                successRate: 0.85
            },
            {
                id: 'craft_energy_cell',
                requiredItems: {
                    'crystal_quartz': 2,
                    'gas_hydrogen': 5
                },
                craftingTime: 3,
                energyCost: 5,
                successRate: 0.95
            },
            {
                id: 'craft_shield_emitter',
                requiredItems: {
                    'metal_titanium': 3,
                    'crystal_quartz': 2,
                    'comp_circuit': 1
                },
                craftingTime: 15,
                energyCost: 30,
                successRate: 0.7
            },
            {
                id: 'craft_plasma_conduit',
                requiredItems: {
                    'metal_titanium': 2,
                    'crystal_dilithium': 1,
                    'comp_circuit': 2
                },
                craftingTime: 20,
                energyCost: 40,
                successRate: 0.6
            }
        ];
        
        // Add recipes to appropriate items and stations
        basicRecipes.forEach(recipe => {
            // Add recipe to basic fabricator
            const basicStation = this.stations.get('basic_fabricator');
            if (basicStation) {
                basicStation.availableRecipes.push(recipe.id);
            }
            
            // Advanced recipes go to advanced forge
            if (recipe.energyCost > 20) {
                const advancedStation = this.stations.get('advanced_forge');
                if (advancedStation) {
                    advancedStation.availableRecipes.push(recipe.id);
                }
            }
            
            // Add to known recipes (player starts with basic knowledge)
            if (recipe.energyCost <= 15) {
                this.knownRecipes.add(recipe.id);
            }
        });
        
        // Update item database with recipes
        this.updateItemRecipes(basicRecipes);
    }

    /**
     * Update item database with crafting recipes
     */
    private updateItemRecipes(recipes: ItemRecipe[]): void {
        recipes.forEach(recipe => {
            // Find the target item for this recipe
            const targetItem = this.findTargetItemForRecipe(recipe.id);
            if (targetItem) {
                targetItem.recipe = recipe;
            }
        });
    }

    /**
     * Find target item for a recipe based on recipe ID
     */
    private findTargetItemForRecipe(recipeId: string): GameItem | undefined {
        // Map recipe IDs to item IDs
        const recipeToItemMap: { [key: string]: string } = {
            'craft_circuit_from_metal': 'comp_circuit',
            'craft_repair_kit': 'tool_repair_kit',
            'craft_energy_cell': 'cons_energy_cell',
            'craft_shield_emitter': 'comp_shield_emitter',
            'craft_plasma_conduit': 'comp_plasma_conduit'
        };
        
        const itemId = recipeToItemMap[recipeId];
        return itemId ? this.itemDatabase.getItem(itemId) : undefined;
    }

    /**
     * Start crafting an item
     */
    startCrafting(recipeId: string, stationId: string): boolean {
        const station = this.stations.get(stationId);
        const targetItem = this.findTargetItemForRecipe(recipeId);
        
        if (!station || !targetItem || !targetItem.recipe) {
            this.events.onCraftingFailed?.('Invalid recipe or station');
            return false;
        }
        
        if (!station.isActive) {
            this.events.onCraftingFailed?.('Crafting station is offline');
            return false;
        }
        
        if (!this.knownRecipes.has(recipeId)) {
            this.events.onCraftingFailed?.('Recipe not yet discovered');
            return false;
        }
        
        if (!station.availableRecipes.includes(recipeId)) {
            this.events.onCraftingFailed?.('Station cannot craft this item');
            return false;
        }
        
        const recipe = targetItem.recipe;
        
        // Check if player has required items
        for (const [itemId, quantity] of Object.entries(recipe.requiredItems)) {
            if (!this.inventory.hasItem(itemId, quantity)) {
                this.events.onCraftingFailed?.(`Insufficient ${itemId}: need ${quantity}`);
                return false;
            }
        }
        
        // TODO: Check energy requirements
        // For now, assume player has enough energy
        
        // Remove required items from inventory
        for (const [itemId, quantity] of Object.entries(recipe.requiredItems)) {
            this.inventory.removeItem(itemId, quantity);
        }
        
        // Create crafting attempt
        const attempt: CraftingAttempt = {
            recipeId,
            station,
            startTime: Date.now(),
            duration: recipe.craftingTime * 1000, // Convert to milliseconds
            energyCost: recipe.energyCost,
            successRate: recipe.successRate
        };
        
        this.activeAttempts.push(attempt);
        this.events.onCraftingStarted?.(attempt);
        
        this.logger.info(`🔧 Started crafting ${targetItem.name}`, {
            station: station.name,
            duration: recipe.craftingTime,
            successRate: recipe.successRate
        });
        
        return true;
    }

    /**
     * Update crafting system
     */
    update(deltaTime: number): void {
        const currentTime = Date.now();
        const completedAttempts: CraftingAttempt[] = [];
        
        // Check for completed crafting attempts
        this.activeAttempts.forEach(attempt => {
            if (currentTime >= attempt.startTime + attempt.duration) {
                completedAttempts.push(attempt);
            }
        });
        
        // Process completed attempts
        completedAttempts.forEach(attempt => {
            this.completeCrafting(attempt);
        });
        
        // Remove completed attempts
        this.activeAttempts = this.activeAttempts.filter(
            attempt => !completedAttempts.includes(attempt)
        );
    }

    /**
     * Complete a crafting attempt
     */
    private completeCrafting(attempt: CraftingAttempt): void {
        const targetItem = this.findTargetItemForRecipe(attempt.recipeId);
        if (!targetItem) return;
        
        // Determine success based on success rate
        const success = Math.random() < attempt.successRate;
        
        if (success) {
            // Add crafted item to inventory
            const added = this.inventory.addItem(targetItem, 1);
            if (added) {
                this.logger.info(`✅ Successfully crafted ${targetItem.name}`);
                this.events.onCraftingCompleted?.(targetItem, true);
            } else {
                this.logger.warn(`📦 Inventory full - ${targetItem.name} lost`);
                this.events.onCraftingFailed?.('Inventory full - item lost');
            }
        } else {
            this.logger.warn(`❌ Crafting failed: ${targetItem.name}`);
            this.events.onCraftingCompleted?.(targetItem, false);
            
            // On failure, return some materials (50% chance for each)
            if (targetItem.recipe) {
                for (const [itemId, quantity] of Object.entries(targetItem.recipe.requiredItems)) {
                    if (Math.random() < 0.5) {
                        const returnQuantity = Math.ceil(quantity * 0.3); // Return 30% of materials
                        const item = this.itemDatabase.getItem(itemId);
                        if (item) {
                            this.inventory.addItem(item, returnQuantity);
                        }
                    }
                }
            }
        }
    }

    /**
     * Learn a new recipe
     */
    learnRecipe(recipeId: string): boolean {
        if (this.knownRecipes.has(recipeId)) {
            return false; // Already known
        }
        
        this.knownRecipes.add(recipeId);
        this.logger.info(`📚 Learned new recipe: ${recipeId}`);
        return true;
    }

    /**
     * Get available recipes for a station
     */
    getAvailableRecipes(stationId: string): GameItem[] {
        const station = this.stations.get(stationId);
        if (!station) return [];
        
        return station.availableRecipes
            .filter(recipeId => this.knownRecipes.has(recipeId))
            .map(recipeId => this.findTargetItemForRecipe(recipeId))
            .filter(item => item !== undefined) as GameItem[];
    }

    /**
     * Check if recipe can be crafted
     */
    canCraftRecipe(recipeId: string): {
        canCraft: boolean;
        missingItems: { [itemId: string]: number };
        hasStation: boolean;
    } {
        const targetItem = this.findTargetItemForRecipe(recipeId);
        if (!targetItem || !targetItem.recipe) {
            return { canCraft: false, missingItems: {}, hasStation: false };
        }
        
        const recipe = targetItem.recipe;
        const missingItems: { [itemId: string]: number } = {};
        let hasAllItems = true;
        
        // Check required items
        for (const [itemId, required] of Object.entries(recipe.requiredItems)) {
            const available = this.inventory.getItemCount(itemId);
            if (available < required) {
                missingItems[itemId] = required - available;
                hasAllItems = false;
            }
        }
        
        // Check if any station can craft this
        const hasStation = Array.from(this.stations.values()).some(station => 
            station.isActive && station.availableRecipes.includes(recipeId)
        );
        
        return {
            canCraft: hasAllItems && hasStation && this.knownRecipes.has(recipeId),
            missingItems,
            hasStation
        };
    }

    /**
     * Get crafting progress for active attempts
     */
    getCraftingProgress(): Array<{
        recipeId: string;
        itemName: string;
        progress: number; // 0-1
        timeRemaining: number; // seconds
    }> {
        const currentTime = Date.now();
        
        return this.activeAttempts.map(attempt => {
            const elapsed = currentTime - attempt.startTime;
            const progress = Math.min(1, elapsed / attempt.duration);
            const timeRemaining = Math.max(0, (attempt.duration - elapsed) / 1000);
            
            const targetItem = this.findTargetItemForRecipe(attempt.recipeId);
            
            return {
                recipeId: attempt.recipeId,
                itemName: targetItem?.name || 'Unknown',
                progress,
                timeRemaining
            };
        });
    }

    /**
     * Render crafting UI
     */
    render(renderer: Renderer): void {
        if (!this.isVisible) return;
        
        // Render crafting panel
        this.renderCraftingPanel(renderer);
        
        // Render progress indicators
        this.renderCraftingProgress(renderer);
    }

    /**
     * Render main crafting panel
     */
    private renderCraftingPanel(renderer: Renderer): void {
        const panelX = 300;
        const panelY = 100;
        const panelWidth = 400;
        const panelHeight = 300;
        
        // Panel background
        renderer.fillRect(panelX, panelY, panelWidth, panelHeight, { r: 8, g: 12, b: 8 });
        
        // Panel border
        const borderColor = { r: 16, g: 48, b: 16 };
        renderer.drawLine(panelX, panelY, panelX + panelWidth, panelY, borderColor);
        renderer.drawLine(panelX, panelY, panelX, panelY + panelHeight, borderColor);
        renderer.drawLine(panelX + panelWidth, panelY, panelX + panelWidth, panelY + panelHeight, borderColor);
        renderer.drawLine(panelX, panelY + panelHeight, panelX + panelWidth, panelY + panelHeight, borderColor);
        
        // Title
        renderer.renderText('FABRICATION UNIT', panelX + 10, panelY + 10, { r: 12, g: 36, b: 12 }, 12);
        
        // Station list
        let stationY = panelY + 35;
        this.stations.forEach(station => {
            const stationColor = station.isActive ? 
                { r: 12, g: 36, b: 12 } : 
                { r: 32, g: 32, b: 32 };
            
            const statusText = station.isActive ? 'ONLINE' : 'OFFLINE';
            renderer.renderText(`[${station.id}] ${station.name}: ${statusText}`, 
                panelX + 10, stationY, stationColor, 8);
            stationY += 12;
        });
        
        // Available recipes for selected station
        if (this.selectedStation) {
            const recipes = this.getAvailableRecipes(this.selectedStation);
            
            renderer.renderText('AVAILABLE SCHEMATICS:', panelX + 10, stationY + 10, 
                { r: 48, g: 48, b: 48 }, 8);
            
            let recipeY = stationY + 25;
            recipes.forEach(item => {
                const craftability = this.canCraftRecipe(item.recipe!.id);
                const textColor = craftability.canCraft ? 
                    { r: 12, g: 36, b: 12 } : 
                    { r: 72, g: 24, b: 24 };
                
                renderer.renderText(`- ${item.name}`, panelX + 20, recipeY, textColor, 8);
                recipeY += 12;
                
                // Show missing materials
                if (Object.keys(craftability.missingItems).length > 0) {
                    const missingText = Object.entries(craftability.missingItems)
                        .map(([id, count]) => `${count}x ${id}`)
                        .join(', ');
                    renderer.renderText(`  Missing: ${missingText}`, 
                        panelX + 30, recipeY, { r: 48, g: 32, b: 32 }, 7);
                    recipeY += 10;
                }
            });
        }
    }

    /**
     * Render crafting progress
     */
    private renderCraftingProgress(renderer: Renderer): void {
        const progressItems = this.getCraftingProgress();
        if (progressItems.length === 0) return;
        
        const progressX = 50;
        let progressY = 400;
        
        renderer.renderText('FABRICATION IN PROGRESS:', progressX, progressY, 
            { r: 12, g: 36, b: 12 }, 10);
        progressY += 15;
        
        progressItems.forEach(item => {
            // Progress bar
            const barWidth = 200;
            const barHeight = 8;
            const fillWidth = Math.floor(barWidth * item.progress);
            
            // Bar background
            renderer.fillRect(progressX, progressY, barWidth, barHeight, { r: 16, g: 16, b: 16 });
            
            // Bar fill
            const fillColor = item.progress >= 1 ? 
                { r: 12, g: 36, b: 12 } : 
                { r: 32, g: 80, b: 64 };
            renderer.fillRect(progressX, progressY, fillWidth, barHeight, fillColor);
            
            // Item name and time
            renderer.renderText(`${item.itemName} - ${item.timeRemaining.toFixed(1)}s`, 
                progressX + barWidth + 10, progressY, { r: 48, g: 48, b: 48 }, 8);
            
            progressY += 15;
        });
    }

    /**
     * Show/hide crafting UI
     */
    setVisible(visible: boolean): void {
        this.isVisible = visible;
    }

    /**
     * Check if crafting UI is visible
     */
    isCraftingVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Select crafting station
     */
    selectStation(stationId: string): void {
        if (this.stations.has(stationId)) {
            this.selectedStation = stationId;
        }
    }

    /**
     * Get selected station
     */
    getSelectedStation(): CraftingStation | null {
        return this.selectedStation ? this.stations.get(this.selectedStation) || null : null;
    }

    /**
     * Activate/deactivate station
     */
    setStationActive(stationId: string, active: boolean): void {
        const station = this.stations.get(stationId);
        if (station) {
            station.isActive = active;
            this.logger.info(`🔧 Station ${station.name} ${active ? 'activated' : 'deactivated'}`);
        }
    }

    /**
     * Get crafting statistics
     */
    getStats(): {
        knownRecipes: number;
        activeStations: number;
        totalStations: number;
        activeCrafting: number;
    } {
        const activeStations = Array.from(this.stations.values()).filter(s => s.isActive).length;
        
        return {
            knownRecipes: this.knownRecipes.size,
            activeStations,
            totalStations: this.stations.size,
            activeCrafting: this.activeAttempts.length
        };
    }

    /**
     * Save crafting state
     */
    saveState(): any {
        return {
            knownRecipes: Array.from(this.knownRecipes),
            stations: Array.from(this.stations.values()),
            activeAttempts: this.activeAttempts
        };
    }

    /**
     * Load crafting state
     */
    loadState(state: any): void {
        if (state.knownRecipes) {
            this.knownRecipes = new Set(state.knownRecipes);
        }
        
        if (state.stations) {
            state.stations.forEach((stationData: CraftingStation) => {
                this.stations.set(stationData.id, stationData);
            });
        }
        
        if (state.activeAttempts) {
            this.activeAttempts = state.activeAttempts;
        }
        
        this.logger.info('🔧 Crafting state loaded');
    }
}