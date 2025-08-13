/**
 * Player Progression System
 * Complete RPG progression with levels, skills, attributes, and achievements
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';

export enum SkillCategory {
    Combat = 'combat',
    Piloting = 'piloting',
    Engineering = 'engineering',
    Science = 'science',
    Trade = 'trade',
    Exploration = 'exploration'
}

export enum AttributeType {
    Reflexes = 'reflexes',       // Combat speed, evasion
    Intelligence = 'intelligence', // Research, hacking
    Endurance = 'endurance',     // Hull points, fatigue resistance
    Perception = 'perception',   // Detection, accuracy
    Charisma = 'charisma',      // Trade, diplomacy
    Technical = 'technical'      // Engineering, repair efficiency
}

export interface Skill {
    id: string;
    name: string;
    category: SkillCategory;
    level: number;
    experience: number;
    maxLevel: number;
    description: string;
    prerequisite?: string; // Required skill ID
    prerequisiteLevel?: number;
    
    // Effects
    bonuses: SkillBonus[];
}

export interface SkillBonus {
    type: 'damage' | 'accuracy' | 'speed' | 'efficiency' | 'cost_reduction' | 'detection' | 'capacity';
    value: number; // Percentage or flat bonus
    description: string;
}

export interface Attribute {
    type: AttributeType;
    value: number;
    baseValue: number;
    modifiers: AttributeModifier[];
}

export interface AttributeModifier {
    source: string;
    value: number;
    duration: number; // -1 for permanent
    description: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    category: string;
    requirements: AchievementRequirement[];
    rewards: AchievementReward[];
    unlocked: boolean;
    unlockedDate?: number;
    hidden: boolean; // Don't show until unlocked
}

export interface AchievementRequirement {
    type: 'kill_enemies' | 'travel_distance' | 'earn_credits' | 'discover_systems' | 'craft_items' | 'complete_missions';
    target: number;
    current: number;
    data?: any; // Additional requirement data
}

export interface AchievementReward {
    type: 'experience' | 'credits' | 'skill_points' | 'attribute_points' | 'item';
    value: number;
    itemId?: string;
}

export interface CharacterSheet {
    // Basic info
    name: string;
    level: number;
    experience: number;
    experienceToNext: number;
    
    // Points
    skillPoints: number;
    attributePoints: number;
    
    // Statistics
    totalPlayTime: number;
    enemiesDefeated: number;
    systemsExplored: number;
    distanceTraveled: number;
    creditsEarned: number;
    itemsCrafted: number;
    
    // Skills and attributes
    skills: Map<string, Skill>;
    attributes: Map<AttributeType, Attribute>;
    achievements: Map<string, Achievement>;
}

export interface ProgressionEvents {
    onLevelUp?: (newLevel: number, rewards: { skillPoints: number, attributePoints: number }) => void;
    onSkillLevelUp?: (skill: Skill, newLevel: number) => void;
    onAchievementUnlocked?: (achievement: Achievement) => void;
    onAttributeChanged?: (attribute: AttributeType, oldValue: number, newValue: number) => void;
}

export class PlayerProgression {
    private character: CharacterSheet;
    private events: ProgressionEvents;
    
    // Experience tables
    private levelExperienceTable: number[] = [];
    private skillExperienceTable: number[] = [];
    
    private logger: Logger;

    constructor(events: ProgressionEvents = {}) {
        this.logger = new Logger('PlayerProgression');
        this.events = events;
        
        this.generateExperienceTables();
        this.initializeCharacter();
        this.initializeSkills();
        this.initializeAchievements();
        
        this.logger.info('🎭 Player progression system initialized');
    }

    /**
     * Generate experience tables for levels and skills
     */
    private generateExperienceTables(): void {
        // Level experience: exponential growth
        for (let level = 1; level <= 100; level++) {
            const baseXP = 100;
            const multiplier = Math.pow(1.15, level - 1);
            this.levelExperienceTable.push(Math.floor(baseXP * multiplier));
        }
        
        // Skill experience: linear with slight exponential
        for (let level = 1; level <= 50; level++) {
            const baseXP = 50;
            const multiplier = Math.pow(1.1, level - 1);
            this.skillExperienceTable.push(Math.floor(baseXP * multiplier));
        }
    }

    /**
     * Initialize character with default values
     */
    private initializeCharacter(): void {
        this.character = {
            name: 'Captain',
            level: 1,
            experience: 0,
            experienceToNext: this.levelExperienceTable[1],
            
            skillPoints: 5,
            attributePoints: 10,
            
            totalPlayTime: 0,
            enemiesDefeated: 0,
            systemsExplored: 0,
            distanceTraveled: 0,
            creditsEarned: 0,
            itemsCrafted: 0,
            
            skills: new Map(),
            attributes: new Map(),
            achievements: new Map()
        };
        
        // Initialize attributes
        for (const attrType of Object.values(AttributeType)) {
            this.character.attributes.set(attrType, {
                type: attrType,
                value: 10,
                baseValue: 10,
                modifiers: []
            });
        }
    }

    /**
     * Initialize skill tree
     */
    private initializeSkills(): void {
        const skills: Skill[] = [
            // Combat Skills
            {
                id: 'weapon_proficiency',
                name: 'Weapon Proficiency',
                category: SkillCategory.Combat,
                level: 0,
                experience: 0,
                maxLevel: 25,
                description: 'Increases weapon damage and accuracy',
                bonuses: [
                    { type: 'damage', value: 2, description: '+2% weapon damage per level' },
                    { type: 'accuracy', value: 1, description: '+1% accuracy per level' }
                ]
            },
            {
                id: 'tactical_combat',
                name: 'Tactical Combat',
                category: SkillCategory.Combat,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Reduces weapon heat buildup and cooldowns',
                prerequisite: 'weapon_proficiency',
                prerequisiteLevel: 5,
                bonuses: [
                    { type: 'efficiency', value: 3, description: '+3% weapon efficiency per level' },
                    { type: 'cost_reduction', value: 2, description: '-2% energy cost per level' }
                ]
            },
            {
                id: 'shield_mastery',
                name: 'Shield Mastery',
                category: SkillCategory.Combat,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Improves shield capacity and regeneration',
                bonuses: [
                    { type: 'capacity', value: 5, description: '+5% shield capacity per level' },
                    { type: 'efficiency', value: 3, description: '+3% regeneration rate per level' }
                ]
            },
            
            // Piloting Skills
            {
                id: 'ship_handling',
                name: 'Ship Handling',
                category: SkillCategory.Piloting,
                level: 0,
                experience: 0,
                maxLevel: 25,
                description: 'Improves ship maneuverability and speed',
                bonuses: [
                    { type: 'speed', value: 2, description: '+2% ship speed per level' },
                    { type: 'efficiency', value: 1, description: '+1% turn rate per level' }
                ]
            },
            {
                id: 'evasive_maneuvers',
                name: 'Evasive Maneuvers',
                category: SkillCategory.Piloting,
                level: 0,
                experience: 0,
                maxLevel: 15,
                description: 'Increases evasion chance and reduces incoming damage',
                prerequisite: 'ship_handling',
                prerequisiteLevel: 8,
                bonuses: [
                    { type: 'efficiency', value: 2, description: '+2% evasion chance per level' }
                ]
            },
            {
                id: 'warp_navigation',
                name: 'Warp Navigation',
                category: SkillCategory.Piloting,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Reduces warp energy costs and improves efficiency',
                bonuses: [
                    { type: 'cost_reduction', value: 3, description: '-3% warp energy cost per level' },
                    { type: 'speed', value: 1, description: '+1% warp speed per level' }
                ]
            },
            
            // Engineering Skills
            {
                id: 'system_repair',
                name: 'System Repair',
                category: SkillCategory.Engineering,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Improves repair efficiency and reduces costs',
                bonuses: [
                    { type: 'efficiency', value: 4, description: '+4% repair efficiency per level' },
                    { type: 'cost_reduction', value: 2, description: '-2% repair cost per level' }
                ]
            },
            {
                id: 'power_management',
                name: 'Power Management',
                category: SkillCategory.Engineering,
                level: 0,
                experience: 0,
                maxLevel: 15,
                description: 'Increases power capacity and efficiency',
                bonuses: [
                    { type: 'capacity', value: 3, description: '+3% power capacity per level' },
                    { type: 'efficiency', value: 2, description: '+2% power efficiency per level' }
                ]
            },
            {
                id: 'advanced_crafting',
                name: 'Advanced Crafting',
                category: SkillCategory.Engineering,
                level: 0,
                experience: 0,
                maxLevel: 25,
                description: 'Increases crafting success rates and unlocks recipes',
                prerequisite: 'system_repair',
                prerequisiteLevel: 5,
                bonuses: [
                    { type: 'efficiency', value: 3, description: '+3% crafting success rate per level' }
                ]
            },
            
            // Science Skills
            {
                id: 'sensor_analysis',
                name: 'Sensor Analysis',
                category: SkillCategory.Science,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Improves scanning range and accuracy',
                bonuses: [
                    { type: 'detection', value: 5, description: '+5% scanning range per level' },
                    { type: 'efficiency', value: 2, description: '+2% scan accuracy per level' }
                ]
            },
            {
                id: 'research_methodology',
                name: 'Research Methodology',
                category: SkillCategory.Science,
                level: 0,
                experience: 0,
                maxLevel: 15,
                description: 'Increases research speed and technology unlock rate',
                bonuses: [
                    { type: 'efficiency', value: 4, description: '+4% research speed per level' }
                ]
            },
            
            // Trade Skills
            {
                id: 'negotiation',
                name: 'Negotiation',
                category: SkillCategory.Trade,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Improves trade prices and contract rewards',
                bonuses: [
                    { type: 'efficiency', value: 2, description: '+2% trade profit per level' }
                ]
            },
            {
                id: 'market_analysis',
                name: 'Market Analysis',
                category: SkillCategory.Trade,
                level: 0,
                experience: 0,
                maxLevel: 15,
                description: 'Provides better market information and price predictions',
                prerequisite: 'negotiation',
                prerequisiteLevel: 5,
                bonuses: [
                    { type: 'detection', value: 3, description: '+3% market insight per level' }
                ]
            },
            
            // Exploration Skills
            {
                id: 'stellar_cartography',
                name: 'Stellar Cartography',
                category: SkillCategory.Exploration,
                level: 0,
                experience: 0,
                maxLevel: 20,
                description: 'Improves exploration rewards and discovery rates',
                bonuses: [
                    { type: 'efficiency', value: 3, description: '+3% discovery rate per level' },
                    { type: 'detection', value: 2, description: '+2% exploration rewards per level' }
                ]
            },
            {
                id: 'xenobiology',
                name: 'Xenobiology',
                category: SkillCategory.Exploration,
                level: 0,
                experience: 0,
                maxLevel: 15,
                description: 'Increases rewards from biological discoveries',
                prerequisite: 'stellar_cartography',
                prerequisiteLevel: 8,
                bonuses: [
                    { type: 'efficiency', value: 5, description: '+5% biological research rewards per level' }
                ]
            }
        ];
        
        skills.forEach(skill => {
            this.character.skills.set(skill.id, skill);
        });
    }

    /**
     * Initialize achievements
     */
    private initializeAchievements(): void {
        const achievements: Achievement[] = [
            {
                id: 'first_blood',
                name: 'First Blood',
                description: 'Destroy your first enemy ship',
                category: 'Combat',
                requirements: [
                    { type: 'kill_enemies', target: 1, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 50 },
                    { type: 'skill_points', value: 1 }
                ],
                unlocked: false,
                hidden: false
            },
            {
                id: 'ace_pilot',
                name: 'Ace Pilot',
                description: 'Destroy 50 enemy ships',
                category: 'Combat',
                requirements: [
                    { type: 'kill_enemies', target: 50, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 500 },
                    { type: 'skill_points', value: 3 }
                ],
                unlocked: false,
                hidden: false
            },
            {
                id: 'explorer',
                name: 'Explorer',
                description: 'Discover 10 star systems',
                category: 'Exploration',
                requirements: [
                    { type: 'discover_systems', target: 10, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 200 },
                    { type: 'attribute_points', value: 2 }
                ],
                unlocked: false,
                hidden: false
            },
            {
                id: 'master_craftsman',
                name: 'Master Craftsman',
                description: 'Craft 100 items',
                category: 'Engineering',
                requirements: [
                    { type: 'craft_items', target: 100, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 300 },
                    { type: 'skill_points', value: 2 }
                ],
                unlocked: false,
                hidden: false
            },
            {
                id: 'millionaire',
                name: 'Millionaire',
                description: 'Earn 1,000,000 credits',
                category: 'Trade',
                requirements: [
                    { type: 'earn_credits', target: 1000000, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 1000 },
                    { type: 'attribute_points', value: 5 }
                ],
                unlocked: false,
                hidden: false
            },
            {
                id: 'long_journey',
                name: 'Long Journey',
                description: 'Travel 100,000 kilometers',
                category: 'Exploration',
                requirements: [
                    { type: 'travel_distance', target: 100000, current: 0 }
                ],
                rewards: [
                    { type: 'experience', value: 250 },
                    { type: 'skill_points', value: 1 }
                ],
                unlocked: false,
                hidden: false
            }
        ];
        
        achievements.forEach(achievement => {
            this.character.achievements.set(achievement.id, achievement);
        });
    }

    /**
     * Add experience to character
     */
    addExperience(amount: number): void {
        this.character.experience += amount;
        
        // Check for level ups
        while (this.character.experience >= this.character.experienceToNext) {
            this.levelUp();
        }
        
        this.logger.debug(`+${amount} XP (Total: ${this.character.experience})`);
    }

    /**
     * Level up character
     */
    private levelUp(): void {
        this.character.level++;
        this.character.experience -= this.character.experienceToNext;
        
        // Calculate next level requirement
        if (this.character.level < this.levelExperienceTable.length) {
            this.character.experienceToNext = this.levelExperienceTable[this.character.level];
        } else {
            this.character.experienceToNext = this.levelExperienceTable[this.levelExperienceTable.length - 1];
        }
        
        // Level rewards
        const skillPointsGained = this.character.level % 2 === 0 ? 2 : 1; // 2 every even level, 1 every odd
        const attributePointsGained = this.character.level % 5 === 0 ? 2 : 0; // 2 every 5 levels
        
        this.character.skillPoints += skillPointsGained;
        this.character.attributePoints += attributePointsGained;
        
        this.events.onLevelUp?.(this.character.level, {
            skillPoints: skillPointsGained,
            attributePoints: attributePointsGained
        });
        
        this.logger.info(`🎉 Level Up! Now level ${this.character.level}`, {
            skillPoints: skillPointsGained,
            attributePoints: attributePointsGained
        });
    }

    /**
     * Add skill experience
     */
    addSkillExperience(skillId: string, amount: number): void {
        const skill = this.character.skills.get(skillId);
        if (!skill || skill.level >= skill.maxLevel) return;
        
        skill.experience += amount;
        
        // Check for skill level up
        const requiredXP = this.skillExperienceTable[skill.level] || this.skillExperienceTable[this.skillExperienceTable.length - 1];
        
        if (skill.experience >= requiredXP) {
            skill.level++;
            skill.experience -= requiredXP;
            
            this.events.onSkillLevelUp?.(skill, skill.level);
            
            this.logger.info(`📈 Skill Level Up: ${skill.name} → ${skill.level}`);
        }
    }

    /**
     * Spend skill points to level up a skill
     */
    levelUpSkill(skillId: string): boolean {
        const skill = this.character.skills.get(skillId);
        if (!skill || skill.level >= skill.maxLevel) return false;
        
        // Check prerequisites
        if (skill.prerequisite) {
            const prereqSkill = this.character.skills.get(skill.prerequisite);
            if (!prereqSkill || prereqSkill.level < (skill.prerequisiteLevel || 1)) {
                this.logger.warn(`Prerequisite not met: ${skill.prerequisite} level ${skill.prerequisiteLevel}`);
                return false;
            }
        }
        
        // Check skill points
        const cost = Math.max(1, Math.floor(skill.level / 5) + 1); // Increasing cost
        if (this.character.skillPoints < cost) {
            this.logger.warn(`Not enough skill points: need ${cost}, have ${this.character.skillPoints}`);
            return false;
        }
        
        // Level up skill
        this.character.skillPoints -= cost;
        skill.level++;
        
        this.events.onSkillLevelUp?.(skill, skill.level);
        
        this.logger.info(`💫 Manual skill upgrade: ${skill.name} → ${skill.level} (Cost: ${cost} SP)`);
        
        return true;
    }

    /**
     * Increase attribute
     */
    increaseAttribute(type: AttributeType, amount: number = 1): boolean {
        const cost = amount * 2; // 2 attribute points per increase
        if (this.character.attributePoints < cost) {
            this.logger.warn(`Not enough attribute points: need ${cost}, have ${this.character.attributePoints}`);
            return false;
        }
        
        const attribute = this.character.attributes.get(type);
        if (!attribute) return false;
        
        const oldValue = attribute.value;
        attribute.baseValue += amount;
        this.recalculateAttribute(type);
        
        this.character.attributePoints -= cost;
        
        this.events.onAttributeChanged?.(type, oldValue, attribute.value);
        
        this.logger.info(`⚡ Attribute increased: ${type} → ${attribute.value} (Cost: ${cost} AP)`);
        
        return true;
    }

    /**
     * Add temporary attribute modifier
     */
    addAttributeModifier(type: AttributeType, modifier: AttributeModifier): void {
        const attribute = this.character.attributes.get(type);
        if (!attribute) return;
        
        attribute.modifiers.push(modifier);
        this.recalculateAttribute(type);
        
        this.logger.debug(`Applied modifier to ${type}: ${modifier.value} from ${modifier.source}`);
    }

    /**
     * Remove attribute modifier
     */
    removeAttributeModifier(type: AttributeType, source: string): void {
        const attribute = this.character.attributes.get(type);
        if (!attribute) return;
        
        attribute.modifiers = attribute.modifiers.filter(mod => mod.source !== source);
        this.recalculateAttribute(type);
        
        this.logger.debug(`Removed modifier from ${type}: ${source}`);
    }

    /**
     * Recalculate attribute value with modifiers
     */
    private recalculateAttribute(type: AttributeType): void {
        const attribute = this.character.attributes.get(type);
        if (!attribute) return;
        
        const oldValue = attribute.value;
        attribute.value = attribute.baseValue;
        
        // Apply modifiers
        attribute.modifiers.forEach(mod => {
            attribute.value += mod.value;
        });
        
        // Minimum value of 1
        attribute.value = Math.max(1, attribute.value);
        
        if (oldValue !== attribute.value) {
            this.events.onAttributeChanged?.(type, oldValue, attribute.value);
        }
    }

    /**
     * Update achievement progress
     */
    updateAchievementProgress(type: string, amount: number, data?: any): void {
        for (const achievement of this.character.achievements.values()) {
            if (achievement.unlocked) continue;
            
            for (const req of achievement.requirements) {
                if (req.type === type) {
                    req.current = Math.min(req.target, req.current + amount);
                    
                    // Check if achievement is completed
                    if (this.isAchievementCompleted(achievement)) {
                        this.unlockAchievement(achievement.id);
                    }
                }
            }
        }
    }

    /**
     * Check if achievement is completed
     */
    private isAchievementCompleted(achievement: Achievement): boolean {
        return achievement.requirements.every(req => req.current >= req.target);
    }

    /**
     * Unlock achievement
     */
    private unlockAchievement(achievementId: string): void {
        const achievement = this.character.achievements.get(achievementId);
        if (!achievement || achievement.unlocked) return;
        
        achievement.unlocked = true;
        achievement.unlockedDate = Date.now();
        
        // Apply rewards
        achievement.rewards.forEach(reward => {
            switch (reward.type) {
                case 'experience':
                    this.addExperience(reward.value);
                    break;
                case 'skill_points':
                    this.character.skillPoints += reward.value;
                    break;
                case 'attribute_points':
                    this.character.attributePoints += reward.value;
                    break;
                case 'credits':
                    this.character.creditsEarned += reward.value;
                    break;
            }
        });
        
        this.events.onAchievementUnlocked?.(achievement);
        
        this.logger.info(`🏆 Achievement Unlocked: ${achievement.name}`, {
            rewards: achievement.rewards
        });
    }

    /**
     * Update character statistics
     */
    updateStatistics(stats: {
        playTime?: number;
        enemiesDefeated?: number;
        systemsExplored?: number;
        distanceTraveled?: number;
        creditsEarned?: number;
        itemsCrafted?: number;
    }): void {
        if (stats.playTime) this.character.totalPlayTime += stats.playTime;
        if (stats.enemiesDefeated) {
            this.character.enemiesDefeated += stats.enemiesDefeated;
            this.updateAchievementProgress('kill_enemies', stats.enemiesDefeated);
        }
        if (stats.systemsExplored) {
            this.character.systemsExplored += stats.systemsExplored;
            this.updateAchievementProgress('discover_systems', stats.systemsExplored);
        }
        if (stats.distanceTraveled) {
            this.character.distanceTraveled += stats.distanceTraveled;
            this.updateAchievementProgress('travel_distance', stats.distanceTraveled);
        }
        if (stats.creditsEarned) {
            this.character.creditsEarned += stats.creditsEarned;
            this.updateAchievementProgress('earn_credits', stats.creditsEarned);
        }
        if (stats.itemsCrafted) {
            this.character.itemsCrafted += stats.itemsCrafted;
            this.updateAchievementProgress('craft_items', stats.itemsCrafted);
        }
    }

    /**
     * Get skill bonus value
     */
    getSkillBonus(skillId: string, bonusType: string): number {
        const skill = this.character.skills.get(skillId);
        if (!skill) return 0;
        
        const bonus = skill.bonuses.find(b => b.type === bonusType);
        if (!bonus) return 0;
        
        return bonus.value * skill.level;
    }

    /**
     * Get total bonus from all skills of a category
     */
    getCategoryBonus(category: SkillCategory, bonusType: string): number {
        let total = 0;
        
        for (const skill of this.character.skills.values()) {
            if (skill.category === category) {
                total += this.getSkillBonus(skill.id, bonusType);
            }
        }
        
        return total;
    }

    /**
     * Get attribute value
     */
    getAttributeValue(type: AttributeType): number {
        const attribute = this.character.attributes.get(type);
        return attribute ? attribute.value : 10;
    }

    /**
     * Get character sheet
     */
    getCharacterSheet(): CharacterSheet {
        return { ...this.character };
    }

    /**
     * Get available skills for leveling
     */
    getAvailableSkills(): Skill[] {
        return Array.from(this.character.skills.values()).filter(skill => {
            if (skill.level >= skill.maxLevel) return false;
            
            // Check prerequisites
            if (skill.prerequisite) {
                const prereqSkill = this.character.skills.get(skill.prerequisite);
                if (!prereqSkill || prereqSkill.level < (skill.prerequisiteLevel || 1)) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * Get unlocked achievements
     */
    getUnlockedAchievements(): Achievement[] {
        return Array.from(this.character.achievements.values()).filter(a => a.unlocked);
    }

    /**
     * Get achievement progress
     */
    getAchievementProgress(): Achievement[] {
        return Array.from(this.character.achievements.values()).filter(a => !a.unlocked && !a.hidden);
    }

    /**
     * Save character data
     */
    saveCharacter(): any {
        return {
            character: {
                ...this.character,
                skills: Array.from(this.character.skills.entries()),
                attributes: Array.from(this.character.attributes.entries()),
                achievements: Array.from(this.character.achievements.entries())
            }
        };
    }

    /**
     * Load character data
     */
    loadCharacter(data: any): void {
        if (data.character) {
            this.character = {
                ...data.character,
                skills: new Map(data.character.skills),
                attributes: new Map(data.character.attributes),
                achievements: new Map(data.character.achievements)
            };
            
            this.logger.info('📜 Character data loaded', {
                level: this.character.level,
                experience: this.character.experience
            });
        }
    }

    /**
     * Get progression statistics
     */
    getProgressionStats(): {
        totalSkillLevels: number;
        highestSkillLevel: number;
        totalAttributePoints: number;
        achievementsUnlocked: number;
        totalAchievements: number;
        progressionPercentage: number;
    } {
        const totalSkillLevels = Array.from(this.character.skills.values())
            .reduce((sum, skill) => sum + skill.level, 0);
        
        const highestSkillLevel = Math.max(...Array.from(this.character.skills.values())
            .map(skill => skill.level));
        
        const totalAttributePoints = Array.from(this.character.attributes.values())
            .reduce((sum, attr) => sum + attr.baseValue, 0);
        
        const achievementsUnlocked = Array.from(this.character.achievements.values())
            .filter(a => a.unlocked).length;
        
        const totalAchievements = this.character.achievements.size;
        
        const maxSkillLevels = Array.from(this.character.skills.values())
            .reduce((sum, skill) => sum + skill.maxLevel, 0);
        
        const progressionPercentage = Math.min(100, 
            (this.character.level / 50) * 30 + 
            (totalSkillLevels / maxSkillLevels) * 40 + 
            (achievementsUnlocked / totalAchievements) * 30
        );
        
        return {
            totalSkillLevels,
            highestSkillLevel,
            totalAttributePoints,
            achievementsUnlocked,
            totalAchievements,
            progressionPercentage
        };
    }
}