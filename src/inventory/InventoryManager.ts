/**
 * Inventory Management System
 * Grid-based inventory with advanced management features and retro UI
 */

import { Logger } from '@utils/Logger';
import { GameItem, ItemStack, ItemType, ItemRarity, ItemDatabase } from '@items/ItemSystem';
import { Renderer, Color, Vector2 } from '@core/Renderer';

export interface InventoryConfig {
    maxSlots: number;
    gridWidth: number;
    gridHeight: number;
    maxWeight: number;
    maxVolume: number;
    allowStacking: boolean;
}

export interface InventorySlot {
    index: number;
    item: ItemStack | null;
    x: number; // Grid position
    y: number;
    locked: boolean; // Locked slots can't be used
    reserved: boolean; // Reserved for specific item types
}

export interface InventoryFilter {
    type?: ItemType;
    rarity?: ItemRarity;
    searchText?: string;
    showOnlyUsable?: boolean;
}

export interface InventorySortOptions {
    by: 'name' | 'type' | 'rarity' | 'quantity' | 'value';
    descending: boolean;
    groupByType: boolean;
}

export interface InventoryEvents {
    onItemAdded?: (item: GameItem, quantity: number) => void;
    onItemRemoved?: (item: GameItem, quantity: number) => void;
    onInventoryFull?: () => void;
    onWeightExceeded?: () => void;
    onVolumeExceeded?: () => void;
    onSlotSelected?: (slot: InventorySlot) => void;
}

export class InventoryManager {
    private config: InventoryConfig;
    private events: InventoryEvents;
    private itemDatabase: ItemDatabase;
    
    // Storage
    private slots: InventorySlot[] = [];
    private totalWeight: number = 0;
    private totalVolume: number = 0;
    
    // UI State
    private selectedSlot: number = -1;
    private draggedItem: ItemStack | null = null;
    private filter: InventoryFilter = {};
    private sortOptions: InventorySortOptions = { by: 'name', descending: false, groupByType: false };
    private isVisible: boolean = false;
    
    // Visual properties
    private slotSize: number = 32;
    private slotSpacing: number = 2;
    private panelX: number = 50;
    private panelY: number = 50;
    
    private logger: Logger;

    constructor(
        config: Partial<InventoryConfig> = {},
        events: InventoryEvents = {},
        itemDatabase: ItemDatabase
    ) {
        this.logger = new Logger('InventoryManager');
        this.itemDatabase = itemDatabase;
        this.events = events;
        
        this.config = {
            maxSlots: 50,
            gridWidth: 10,
            gridHeight: 5,
            maxWeight: 1000,
            maxVolume: 500,
            allowStacking: true,
            ...config
        };
        
        this.initializeSlots();
        
        this.logger.info('📦 Inventory manager initialized', {
            slots: this.config.maxSlots,
            maxWeight: this.config.maxWeight,
            maxVolume: this.config.maxVolume
        });
    }

    /**
     * Initialize inventory slots
     */
    private initializeSlots(): void {
        this.slots = [];
        
        for (let i = 0; i < this.config.maxSlots; i++) {
            const x = i % this.config.gridWidth;
            const y = Math.floor(i / this.config.gridWidth);
            
            this.slots.push({
                index: i,
                item: null,
                x,
                y,
                locked: false,
                reserved: false
            });
        }
    }

    /**
     * Add item to inventory
     */
    addItem(item: GameItem, quantity: number = 1): boolean {
        if (quantity <= 0) return false;
        
        let remainingQuantity = quantity;
        
        // Try to stack with existing items first
        if (this.config.allowStacking && item.stats.maxStack > 1) {
            for (const slot of this.slots) {
                if (slot.item && slot.item.item.id === item.id) {
                    const canAdd = Math.min(remainingQuantity, item.stats.maxStack - slot.item.quantity);
                    if (canAdd > 0) {
                        slot.item.quantity += canAdd;
                        remainingQuantity -= canAdd;
                        
                        if (remainingQuantity === 0) break;
                    }
                }
            }
        }
        
        // Add to empty slots
        while (remainingQuantity > 0) {
            const emptySlot = this.findEmptySlot();
            if (!emptySlot) {
                this.events.onInventoryFull?.();
                return false;
            }
            
            const stackSize = Math.min(remainingQuantity, item.stats.maxStack);
            
            // Check weight and volume constraints
            const addedWeight = item.stats.mass * stackSize;
            const addedVolume = item.stats.volume * stackSize;
            
            if (this.totalWeight + addedWeight > this.config.maxWeight) {
                this.events.onWeightExceeded?.();
                return false;
            }
            
            if (this.totalVolume + addedVolume > this.config.maxVolume) {
                this.events.onVolumeExceeded?.();
                return false;
            }
            
            // Add to slot
            emptySlot.item = {
                item: item,
                quantity: stackSize,
                condition: item.type === ItemType.Equipment ? 1.0 : undefined
            };
            
            this.totalWeight += addedWeight;
            this.totalVolume += addedVolume;
            remainingQuantity -= stackSize;
        }
        
        this.events.onItemAdded?.(item, quantity);
        this.logger.debug(`Added ${quantity}x ${item.name} to inventory`);
        
        return true;
    }

    /**
     * Remove item from inventory
     */
    removeItem(itemId: string, quantity: number = 1): boolean {
        if (quantity <= 0) return false;
        
        let remainingQuantity = quantity;
        
        for (const slot of this.slots) {
            if (slot.item && slot.item.item.id === itemId && remainingQuantity > 0) {
                const canRemove = Math.min(remainingQuantity, slot.item.quantity);
                
                // Update weight and volume
                const removedWeight = slot.item.item.stats.mass * canRemove;
                const removedVolume = slot.item.item.stats.volume * canRemove;
                this.totalWeight -= removedWeight;
                this.totalVolume -= removedVolume;
                
                slot.item.quantity -= canRemove;
                remainingQuantity -= canRemove;
                
                if (slot.item.quantity === 0) {
                    const removedItem = slot.item.item;
                    slot.item = null;
                    this.events.onItemRemoved?.(removedItem, canRemove);
                }
            }
        }
        
        return remainingQuantity === 0;
    }

    /**
     * Move item between slots
     */
    moveItem(fromSlot: number, toSlot: number): boolean {
        if (fromSlot < 0 || fromSlot >= this.slots.length || 
            toSlot < 0 || toSlot >= this.slots.length) {
            return false;
        }
        
        const from = this.slots[fromSlot];
        const to = this.slots[toSlot];
        
        if (!from.item || to.locked) return false;
        
        // If target slot is empty, move the item
        if (!to.item) {
            to.item = from.item;
            from.item = null;
            return true;
        }
        
        // If both slots have the same item and stacking is allowed
        if (this.config.allowStacking && 
            from.item.item.id === to.item.item.id &&
            from.item.item.stats.maxStack > 1) {
            
            const canStack = Math.min(
                from.item.quantity, 
                from.item.item.stats.maxStack - to.item.quantity
            );
            
            if (canStack > 0) {
                to.item.quantity += canStack;
                from.item.quantity -= canStack;
                
                if (from.item.quantity === 0) {
                    from.item = null;
                }
                return true;
            }
        }
        
        // Swap items
        const temp = from.item;
        from.item = to.item;
        to.item = temp;
        
        return true;
    }

    /**
     * Find first empty slot
     */
    private findEmptySlot(): InventorySlot | null {
        return this.slots.find(slot => !slot.item && !slot.locked) || null;
    }

    /**
     * Get item count
     */
    getItemCount(itemId: string): number {
        return this.slots
            .filter(slot => slot.item && slot.item.item.id === itemId)
            .reduce((total, slot) => total + slot.item!.quantity, 0);
    }

    /**
     * Has item
     */
    hasItem(itemId: string, quantity: number = 1): boolean {
        return this.getItemCount(itemId) >= quantity;
    }

    /**
     * Get all items
     */
    getAllItems(): ItemStack[] {
        return this.slots
            .filter(slot => slot.item !== null)
            .map(slot => slot.item!);
    }

    /**
     * Get filtered and sorted items
     */
    getFilteredItems(): ItemStack[] {
        let items = this.getAllItems();
        
        // Apply filters
        if (this.filter.type) {
            items = items.filter(stack => stack.item.type === this.filter.type);
        }
        
        if (this.filter.rarity) {
            items = items.filter(stack => stack.item.rarity === this.filter.rarity);
        }
        
        if (this.filter.searchText) {
            const search = this.filter.searchText.toLowerCase();
            items = items.filter(stack => 
                stack.item.name.toLowerCase().includes(search) ||
                stack.item.description.toLowerCase().includes(search)
            );
        }
        
        // Apply sorting
        items.sort((a, b) => {
            let comparison = 0;
            
            switch (this.sortOptions.by) {
                case 'name':
                    comparison = a.item.name.localeCompare(b.item.name);
                    break;
                case 'type':
                    comparison = a.item.type.localeCompare(b.item.type);
                    break;
                case 'rarity':
                    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'artifact'];
                    comparison = rarityOrder.indexOf(a.item.rarity) - rarityOrder.indexOf(b.item.rarity);
                    break;
                case 'quantity':
                    comparison = a.quantity - b.quantity;
                    break;
            }
            
            return this.sortOptions.descending ? -comparison : comparison;
        });
        
        return items;
    }

    /**
     * Compact inventory (remove gaps)
     */
    compactInventory(): void {
        const items: ItemStack[] = [];
        
        // Collect all items
        this.slots.forEach(slot => {
            if (slot.item) {
                items.push(slot.item);
                slot.item = null;
            }
        });
        
        // Clear weight/volume
        this.totalWeight = 0;
        this.totalVolume = 0;
        
        // Re-add items compactly
        items.forEach(stack => {
            this.addItem(stack.item, stack.quantity);
        });
        
        this.logger.info('📦 Inventory compacted');
    }

    /**
     * Auto-sort inventory
     */
    autoSort(): void {
        const items = this.getAllItems();
        
        // Clear inventory
        this.slots.forEach(slot => slot.item = null);
        this.totalWeight = 0;
        this.totalVolume = 0;
        
        // Sort items
        items.sort((a, b) => {
            // First by type
            if (a.item.type !== b.item.type) {
                return a.item.type.localeCompare(b.item.type);
            }
            
            // Then by rarity
            const rarityOrder = ['artifact', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
            const aRarity = rarityOrder.indexOf(a.item.rarity);
            const bRarity = rarityOrder.indexOf(b.item.rarity);
            
            if (aRarity !== bRarity) {
                return aRarity - bRarity;
            }
            
            // Finally by name
            return a.item.name.localeCompare(b.item.name);
        });
        
        // Re-add sorted items
        items.forEach(stack => {
            this.addItem(stack.item, stack.quantity);
        });
        
        this.logger.info('📦 Inventory auto-sorted');
    }

    /**
     * Get inventory statistics
     */
    getStats(): {
        usedSlots: number;
        totalSlots: number;
        totalWeight: number;
        maxWeight: number;
        totalVolume: number;
        maxVolume: number;
        itemCount: number;
        uniqueItems: number;
        fillPercentage: number;
        weightPercentage: number;
        volumePercentage: number;
    } {
        const usedSlots = this.slots.filter(slot => slot.item !== null).length;
        const uniqueItems = new Set(this.slots
            .filter(slot => slot.item)
            .map(slot => slot.item!.item.id)
        ).size;
        
        const totalItems = this.slots
            .filter(slot => slot.item)
            .reduce((total, slot) => total + slot.item!.quantity, 0);
        
        return {
            usedSlots,
            totalSlots: this.config.maxSlots,
            totalWeight: this.totalWeight,
            maxWeight: this.config.maxWeight,
            totalVolume: this.totalVolume,
            maxVolume: this.config.maxVolume,
            itemCount: totalItems,
            uniqueItems,
            fillPercentage: (usedSlots / this.config.maxSlots) * 100,
            weightPercentage: (this.totalWeight / this.config.maxWeight) * 100,
            volumePercentage: (this.totalVolume / this.config.maxVolume) * 100
        };
    }

    /**
     * Render inventory UI
     */
    render(renderer: Renderer): void {
        if (!this.isVisible) return;
        
        // Render background panel
        this.renderBackground(renderer);
        
        // Render header
        this.renderHeader(renderer);
        
        // Render grid
        this.renderGrid(renderer);
        
        // Render items
        this.renderItems(renderer);
        
        // Render selection
        if (this.selectedSlot >= 0) {
            this.renderSelection(renderer);
        }
        
        // Render dragged item
        if (this.draggedItem) {
            this.renderDraggedItem(renderer);
        }
        
        // Render statistics
        this.renderStats(renderer);
    }

    /**
     * Render background panel
     */
    private renderBackground(renderer: Renderer): void {
        const panelWidth = this.config.gridWidth * (this.slotSize + this.slotSpacing) + 40;
        const panelHeight = this.config.gridHeight * (this.slotSize + this.slotSpacing) + 150;
        
        // Dark panel background
        renderer.fillRect(this.panelX, this.panelY, panelWidth, panelHeight, { r: 8, g: 12, b: 8 });
        
        // Panel border
        renderer.drawLine(this.panelX, this.panelY, this.panelX + panelWidth, this.panelY, { r: 16, g: 48, b: 16 });
        renderer.drawLine(this.panelX, this.panelY, this.panelX, this.panelY + panelHeight, { r: 16, g: 48, b: 16 });
        renderer.drawLine(this.panelX + panelWidth, this.panelY, this.panelX + panelWidth, this.panelY + panelHeight, { r: 16, g: 48, b: 16 });
        renderer.drawLine(this.panelX, this.panelY + panelHeight, this.panelX + panelWidth, this.panelY + panelHeight, { r: 16, g: 48, b: 16 });
    }

    /**
     * Render header
     */
    private renderHeader(renderer: Renderer): void {
        renderer.renderText('INVENTORY', this.panelX + 10, this.panelY + 10, { r: 12, g: 36, b: 12 }, 12);
        
        // Quick action buttons
        const buttonY = this.panelY + 25;
        renderer.renderText('[S]ORT', this.panelX + 10, buttonY, { r: 32, g: 32, b: 32 }, 8);
        renderer.renderText('[C]OMPACT', this.panelX + 80, buttonY, { r: 32, g: 32, b: 32 }, 8);
        renderer.renderText('[F]ILTER', this.panelX + 160, buttonY, { r: 32, g: 32, b: 32 }, 8);
    }

    /**
     * Render inventory grid
     */
    private renderGrid(renderer: Renderer): void {
        const gridStartX = this.panelX + 20;
        const gridStartY = this.panelY + 50;
        
        for (let y = 0; y < this.config.gridHeight; y++) {
            for (let x = 0; x < this.config.gridWidth; x++) {
                const slotX = gridStartX + x * (this.slotSize + this.slotSpacing);
                const slotY = gridStartY + y * (this.slotSize + this.slotSpacing);
                
                const slotIndex = y * this.config.gridWidth + x;
                const slot = this.slots[slotIndex];
                
                // Slot background
                let bgColor = { r: 16, g: 16, b: 16 };
                if (slot.locked) {
                    bgColor = { r: 24, g: 8, b: 8 }; // Red tint for locked
                } else if (slot.reserved) {
                    bgColor = { r: 8, g: 24, b: 8 }; // Green tint for reserved
                }
                
                renderer.fillRect(slotX, slotY, this.slotSize, this.slotSize, bgColor);
                
                // Slot border
                const borderColor = { r: 32, g: 32, b: 32 };
                renderer.drawLine(slotX, slotY, slotX + this.slotSize, slotY, borderColor);
                renderer.drawLine(slotX, slotY, slotX, slotY + this.slotSize, borderColor);
                renderer.drawLine(slotX + this.slotSize, slotY, slotX + this.slotSize, slotY + this.slotSize, borderColor);
                renderer.drawLine(slotX, slotY + this.slotSize, slotX + this.slotSize, slotY + this.slotSize, borderColor);
            }
        }
    }

    /**
     * Render items in slots
     */
    private renderItems(renderer: Renderer): void {
        const gridStartX = this.panelX + 20;
        const gridStartY = this.panelY + 50;
        
        this.slots.forEach((slot, index) => {
            if (!slot.item) return;
            
            const slotX = gridStartX + slot.x * (this.slotSize + this.slotSpacing);
            const slotY = gridStartY + slot.y * (this.slotSize + this.slotSpacing);
            
            // Render item sprite
            const spriteX = slotX + (this.slotSize - 16) / 2;
            const spriteY = slotY + (this.slotSize - 16) / 2;
            this.itemDatabase.renderItemSprite(renderer, slot.item.item, spriteX, spriteY, 1);
            
            // Render quantity if > 1
            if (slot.item.quantity > 1) {
                const quantityText = slot.item.quantity.toString();
                renderer.renderText(quantityText, slotX + this.slotSize - 15, slotY + this.slotSize - 10, 
                    { r: 48, g: 48, b: 48 }, 8);
            }
            
            // Render rarity indicator
            const rarityColor = this.getRarityColor(slot.item.item.rarity);
            renderer.fillRect(slotX + 2, slotY + 2, 4, 4, rarityColor);
            
            // Render condition bar for equipment
            if (slot.item.condition !== undefined) {
                const conditionWidth = Math.floor((this.slotSize - 4) * slot.item.condition);
                const conditionColor = slot.item.condition > 0.7 ? 
                    { r: 12, g: 36, b: 12 } : 
                    slot.item.condition > 0.3 ? 
                        { r: 72, g: 48, b: 12 } : 
                        { r: 72, g: 24, b: 24 };
                
                renderer.fillRect(slotX + 2, slotY + this.slotSize - 4, conditionWidth, 2, conditionColor);
            }
        });
    }

    /**
     * Get rarity color
     */
    private getRarityColor(rarity: ItemRarity): Color {
        switch (rarity) {
            case ItemRarity.Common: return { r: 48, g: 48, b: 48 };
            case ItemRarity.Uncommon: return { r: 32, g: 48, b: 32 };
            case ItemRarity.Rare: return { r: 32, g: 40, b: 48 };
            case ItemRarity.Epic: return { r: 48, g: 32, b: 72 };
            case ItemRarity.Legendary: return { r: 96, g: 64, b: 16 };
            case ItemRarity.Artifact: return { r: 64, g: 32, b: 96 };
            default: return { r: 32, g: 32, b: 32 };
        }
    }

    /**
     * Render selection highlight
     */
    private renderSelection(renderer: Renderer): void {
        const slot = this.slots[this.selectedSlot];
        if (!slot) return;
        
        const gridStartX = this.panelX + 20;
        const gridStartY = this.panelY + 50;
        const slotX = gridStartX + slot.x * (this.slotSize + this.slotSpacing);
        const slotY = gridStartY + slot.y * (this.slotSize + this.slotSpacing);
        
        // Selection highlight
        const highlightColor = { r: 16, g: 48, b: 16 };
        renderer.drawLine(slotX - 1, slotY - 1, slotX + this.slotSize + 1, slotY - 1, highlightColor);
        renderer.drawLine(slotX - 1, slotY - 1, slotX - 1, slotY + this.slotSize + 1, highlightColor);
        renderer.drawLine(slotX + this.slotSize + 1, slotY - 1, slotX + this.slotSize + 1, slotY + this.slotSize + 1, highlightColor);
        renderer.drawLine(slotX - 1, slotY + this.slotSize + 1, slotX + this.slotSize + 1, slotY + this.slotSize + 1, highlightColor);
    }

    /**
     * Render dragged item
     */
    private renderDraggedItem(renderer: Renderer): void {
        // TODO: Implement drag rendering when mouse system is available
    }

    /**
     * Render statistics
     */
    private renderStats(renderer: Renderer): void {
        const stats = this.getStats();
        const statsY = this.panelY + this.config.gridHeight * (this.slotSize + this.slotSpacing) + 70;
        
        const textColor = { r: 48, g: 48, b: 48 };
        
        renderer.renderText(`SLOTS: ${stats.usedSlots}/${stats.totalSlots}`, 
            this.panelX + 10, statsY, textColor, 8);
        
        renderer.renderText(`WEIGHT: ${stats.totalWeight.toFixed(1)}/${stats.maxWeight}`, 
            this.panelX + 10, statsY + 12, textColor, 8);
        
        renderer.renderText(`VOLUME: ${stats.totalVolume.toFixed(1)}/${stats.maxVolume}`, 
            this.panelX + 10, statsY + 24, textColor, 8);
        
        renderer.renderText(`ITEMS: ${stats.itemCount} (${stats.uniqueItems} types)`, 
            this.panelX + 10, statsY + 36, textColor, 8);
    }

    /**
     * Show/hide inventory
     */
    setVisible(visible: boolean): void {
        this.isVisible = visible;
    }

    /**
     * Check if inventory is visible
     */
    isInventoryVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Select slot
     */
    selectSlot(slotIndex: number): void {
        if (slotIndex >= 0 && slotIndex < this.slots.length) {
            this.selectedSlot = slotIndex;
            this.events.onSlotSelected?.(this.slots[slotIndex]);
        }
    }

    /**
     * Get selected slot
     */
    getSelectedSlot(): InventorySlot | null {
        return this.selectedSlot >= 0 ? this.slots[this.selectedSlot] : null;
    }

    /**
     * Use item in selected slot
     */
    useSelectedItem(): boolean {
        const slot = this.getSelectedSlot();
        if (!slot || !slot.item) return false;
        
        const item = slot.item.item;
        
        if (item.isConsumable) {
            // Use consumable item
            this.removeItem(item.id, 1);
            this.logger.info(`Used ${item.name}`);
            return true;
        }
        
        return false;
    }

    /**
     * Set filter
     */
    setFilter(filter: Partial<InventoryFilter>): void {
        this.filter = { ...this.filter, ...filter };
    }

    /**
     * Clear filter
     */
    clearFilter(): void {
        this.filter = {};
    }

    /**
     * Set sort options
     */
    setSortOptions(options: Partial<InventorySortOptions>): void {
        this.sortOptions = { ...this.sortOptions, ...options };
    }

    /**
     * Lock/unlock slot
     */
    setSlotLocked(slotIndex: number, locked: boolean): void {
        if (slotIndex >= 0 && slotIndex < this.slots.length) {
            this.slots[slotIndex].locked = locked;
        }
    }

    /**
     * Reserve/unreserve slot
     */
    setSlotReserved(slotIndex: number, reserved: boolean): void {
        if (slotIndex >= 0 && slotIndex < this.slots.length) {
            this.slots[slotIndex].reserved = reserved;
        }
    }

    /**
     * Clear inventory
     */
    clearInventory(): void {
        this.slots.forEach(slot => slot.item = null);
        this.totalWeight = 0;
        this.totalVolume = 0;
        this.selectedSlot = -1;
        this.logger.info('📦 Inventory cleared');
    }

    /**
     * Save inventory state
     */
    saveState(): any {
        return {
            slots: this.slots.map(slot => ({
                index: slot.index,
                item: slot.item ? {
                    itemId: slot.item.item.id,
                    quantity: slot.item.quantity,
                    condition: slot.item.condition,
                    modifiers: slot.item.modifiers
                } : null,
                locked: slot.locked,
                reserved: slot.reserved
            })),
            totalWeight: this.totalWeight,
            totalVolume: this.totalVolume
        };
    }

    /**
     * Load inventory state
     */
    loadState(state: any): void {
        this.clearInventory();
        
        state.slots.forEach((slotData: any, index: number) => {
            if (index < this.slots.length) {
                const slot = this.slots[index];
                slot.locked = slotData.locked || false;
                slot.reserved = slotData.reserved || false;
                
                if (slotData.item) {
                    const item = this.itemDatabase.getItem(slotData.item.itemId);
                    if (item) {
                        slot.item = {
                            item,
                            quantity: slotData.item.quantity,
                            condition: slotData.item.condition,
                            modifiers: slotData.item.modifiers
                        };
                    }
                }
            }
        });
        
        this.totalWeight = state.totalWeight || 0;
        this.totalVolume = state.totalVolume || 0;
        
        this.logger.info('📦 Inventory state loaded');
    }
}