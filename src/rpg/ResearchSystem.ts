/**
 * Research & Technology System
 * Advanced research tree with technological progression and discoveries
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';
import { GameItem } from '@items/ItemSystem';

export enum ResearchField {
    Physics = 'physics',
    Engineering = 'engineering',
    Biology = 'biology',
    Computing = 'computing',
    Military = 'military',
    Exploration = 'exploration'
}

export enum TechnologyTier {
    Basic = 1,
    Advanced = 2,
    Expert = 3,
    Master = 4,
    Legendary = 5
}

export interface Technology {
    id: string;
    name: string;
    description: string;
    field: ResearchField;
    tier: TechnologyTier;
    
    // Research requirements
    researchCost: number;
    researchTime: number; // Base time in seconds
    prerequisites: string[]; // Required technology IDs
    
    // Research resources
    requiredItems: { itemId: string, quantity: number }[];
    requiredFacilities: string[];
    
    // Unlocks
    unlocks: TechnologyUnlock[];
    
    // Progress
    isUnlocked: boolean;
    isResearching: boolean;
    researchProgress: number;
    researchStartTime: number;
    completedTime?: number;
}

export interface TechnologyUnlock {
    type: 'ship_component' | 'weapon' | 'facility' | 'ability' | 'recipe' | 'upgrade';
    target: string;
    value?: number;
    description: string;
}

export interface ResearchProject {
    id: string;
    technologyId: string;
    facilityId: string;
    assignedScientists: string[];
    startTime: number;
    estimatedCompletion: number;
    efficiency: number; // 0-1 multiplier
    status: 'active' | 'paused' | 'completed' | 'failed';
}

export interface ResearchFacility {
    id: string;
    name: string;
    type: 'laboratory' | 'observatory' | 'workshop' | 'computer_core' | 'testing_chamber';
    efficiency: number; // Research speed multiplier
    specialization: ResearchField[];
    maxProjects: number;
    
    // Current state
    isOperational: boolean;
    currentProjects: string[];
    maintenanceLevel: number; // 0-1
    upgradeLevel: number;
}

export interface Scientist {
    id: string;
    name: string;
    expertise: ResearchField;
    skill: number; // 1-10
    efficiency: number; // Research speed bonus
    
    // Current assignment
    assignedProject?: string;
    assignedFacility?: string;
    
    // Status
    isAvailable: boolean;
    fatigue: number; // 0-1, affects efficiency
    morale: number; // 0-1, affects efficiency
}

export interface ResearchEvents {
    onTechnologyUnlocked?: (technology: Technology) => void;
    onResearchCompleted?: (project: ResearchProject) => void;
    onDiscoveryMade?: (discovery: Discovery) => void;
    onBreakthroughAchieved?: (field: ResearchField, tier: TechnologyTier) => void;
}

export interface Discovery {
    id: string;
    name: string;
    description: string;
    field: ResearchField;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    discoveryTime: number;
    
    // Effects
    researchBonus?: { field: ResearchField, bonus: number };
    unlocksTechnology?: string;
    grantsResources?: { itemId: string, quantity: number }[];
}

export class ResearchSystem {
    private technologies: Map<string, Technology> = new Map();
    private projects: Map<string, ResearchProject> = new Map();
    private facilities: Map<string, ResearchFacility> = new Map();
    private scientists: Map<string, Scientist> = new Map();
    private discoveries: Discovery[] = [];
    
    // Research state
    private totalResearchPoints: number = 0;
    private researchMultipliers: Map<ResearchField, number> = new Map();
    
    private events: ResearchEvents;
    private logger: Logger;

    constructor(events: ResearchEvents = {}) {
        this.logger = new Logger('ResearchSystem');
        this.events = events;
        
        this.initializeResearchMultipliers();
        this.initializeTechnologies();
        this.initializeFacilities();
        this.initializeScientists();
        
        this.logger.info('🔬 Research system initialized');
    }

    /**
     * Initialize research field multipliers
     */
    private initializeResearchMultipliers(): void {
        Object.values(ResearchField).forEach(field => {
            this.researchMultipliers.set(field, 1.0);
        });
    }

    /**
     * Initialize technology tree
     */
    private initializeTechnologies(): void {
        const technologies: Technology[] = [
            // Tier 1 - Basic Technologies
            {
                id: 'basic_sensors',
                name: 'Enhanced Sensors',
                description: 'Improved sensor arrays for better detection range',
                field: ResearchField.Engineering,
                tier: TechnologyTier.Basic,
                researchCost: 100,
                researchTime: 300, // 5 minutes
                prerequisites: [],
                requiredItems: [
                    { itemId: 'comp_circuit', quantity: 5 },
                    { itemId: 'crystal_quartz', quantity: 3 }
                ],
                requiredFacilities: ['basic_lab'],
                unlocks: [
                    { type: 'ship_component', target: 'advanced_sensors', description: 'Unlocks Advanced Sensor Array' },
                    { type: 'ability', target: 'long_range_scan', description: 'Enables long-range scanning' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            {
                id: 'improved_hull',
                name: 'Improved Hull Design',
                description: 'Stronger hull materials and construction techniques',
                field: ResearchField.Engineering,
                tier: TechnologyTier.Basic,
                researchCost: 150,
                researchTime: 450,
                prerequisites: [],
                requiredItems: [
                    { itemId: 'metal_iron', quantity: 10 },
                    { itemId: 'metal_titanium', quantity: 5 }
                ],
                requiredFacilities: ['workshop'],
                unlocks: [
                    { type: 'upgrade', target: 'hull_strength', value: 25, description: '+25% hull strength' },
                    { type: 'ship_component', target: 'reinforced_hull', description: 'Unlocks Reinforced Hull Plating' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            {
                id: 'energy_weapons',
                name: 'Energy Weapon Technology',
                description: 'Basic laser and plasma weapon systems',
                field: ResearchField.Military,
                tier: TechnologyTier.Basic,
                researchCost: 200,
                researchTime: 600,
                prerequisites: [],
                requiredItems: [
                    { itemId: 'energy_antimatter', quantity: 2 },
                    { itemId: 'comp_circuit', quantity: 8 }
                ],
                requiredFacilities: ['basic_lab', 'workshop'],
                unlocks: [
                    { type: 'weapon', target: 'plasma_cannon', description: 'Unlocks Plasma Cannon' },
                    { type: 'upgrade', target: 'energy_efficiency', value: 15, description: '+15% energy weapon efficiency' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            
            // Tier 2 - Advanced Technologies
            {
                id: 'quantum_computing',
                name: 'Quantum Computing',
                description: 'Advanced quantum processors for complex calculations',
                field: ResearchField.Computing,
                tier: TechnologyTier.Advanced,
                researchCost: 500,
                researchTime: 1200,
                prerequisites: ['basic_sensors'],
                requiredItems: [
                    { itemId: 'crystal_dilithium', quantity: 3 },
                    { itemId: 'comp_quantum_processor', quantity: 1 }
                ],
                requiredFacilities: ['computer_core'],
                unlocks: [
                    { type: 'facility', target: 'quantum_lab', description: 'Unlocks Quantum Research Lab' },
                    { type: 'upgrade', target: 'research_speed', value: 30, description: '+30% research speed' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            {
                id: 'shield_technology',
                name: 'Advanced Shielding',
                description: 'Improved shield generators and energy distribution',
                field: ResearchField.Physics,
                tier: TechnologyTier.Advanced,
                researchCost: 400,
                researchTime: 900,
                prerequisites: ['improved_hull', 'energy_weapons'],
                requiredItems: [
                    { itemId: 'comp_shield_emitter', quantity: 3 },
                    { itemId: 'energy_antimatter', quantity: 5 }
                ],
                requiredFacilities: ['testing_chamber'],
                unlocks: [
                    { type: 'ship_component', target: 'adaptive_shields', description: 'Unlocks Adaptive Shield Matrix' },
                    { type: 'upgrade', target: 'shield_capacity', value: 40, description: '+40% shield capacity' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            {
                id: 'warp_optimization',
                name: 'Warp Drive Optimization',
                description: 'Improved warp field stability and efficiency',
                field: ResearchField.Physics,
                tier: TechnologyTier.Advanced,
                researchCost: 600,
                researchTime: 1500,
                prerequisites: ['quantum_computing'],
                requiredItems: [
                    { itemId: 'crystal_dilithium', quantity: 8 },
                    { itemId: 'comp_warp_coil', quantity: 2 }
                ],
                requiredFacilities: ['observatory'],
                unlocks: [
                    { type: 'upgrade', target: 'warp_efficiency', value: 25, description: '+25% warp efficiency' },
                    { type: 'ability', target: 'emergency_warp', description: 'Enables emergency warp escape' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            
            // Tier 3 - Expert Technologies
            {
                id: 'artificial_intelligence',
                name: 'Artificial Intelligence',
                description: 'Advanced AI systems for ship automation',
                field: ResearchField.Computing,
                tier: TechnologyTier.Expert,
                researchCost: 1000,
                researchTime: 2400,
                prerequisites: ['quantum_computing', 'shield_technology'],
                requiredItems: [
                    { itemId: 'comp_ai_core', quantity: 1 },
                    { itemId: 'crystal_dilithium', quantity: 10 }
                ],
                requiredFacilities: ['quantum_lab'],
                unlocks: [
                    { type: 'ship_component', target: 'ai_assistant', description: 'Unlocks AI Ship Assistant' },
                    { type: 'upgrade', target: 'automation_efficiency', value: 50, description: '+50% system automation' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            {
                id: 'exotic_matter',
                name: 'Exotic Matter Research',
                description: 'Studies of exotic matter and its applications',
                field: ResearchField.Physics,
                tier: TechnologyTier.Expert,
                researchCost: 1200,
                researchTime: 3000,
                prerequisites: ['warp_optimization'],
                requiredItems: [
                    { itemId: 'exotic_dark_matter', quantity: 3 },
                    { itemId: 'comp_containment_field', quantity: 2 }
                ],
                requiredFacilities: ['testing_chamber', 'quantum_lab'],
                unlocks: [
                    { type: 'weapon', target: 'exotic_weapons', description: 'Unlocks Exotic Matter Weapons' },
                    { type: 'ability', target: 'phase_shift', description: 'Enables temporary phase shifting' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            
            // Tier 4 - Master Technologies
            {
                id: 'consciousness_transfer',
                name: 'Consciousness Transfer',
                description: 'Technology to transfer consciousness between vessels',
                field: ResearchField.Biology,
                tier: TechnologyTier.Master,
                researchCost: 2000,
                researchTime: 4800,
                prerequisites: ['artificial_intelligence', 'exotic_matter'],
                requiredItems: [
                    { itemId: 'bio_neural_matrix', quantity: 1 },
                    { itemId: 'comp_ai_core', quantity: 3 }
                ],
                requiredFacilities: ['quantum_lab', 'bio_lab'],
                unlocks: [
                    { type: 'ability', target: 'backup_consciousness', description: 'Enables consciousness backup' },
                    { type: 'ship_component', target: 'neural_interface', description: 'Direct neural ship control' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            },
            
            // Tier 5 - Legendary Technologies
            {
                id: 'reality_manipulation',
                name: 'Reality Manipulation',
                description: 'Ultimate technology to alter space-time itself',
                field: ResearchField.Physics,
                tier: TechnologyTier.Legendary,
                researchCost: 5000,
                researchTime: 10000,
                prerequisites: ['consciousness_transfer'],
                requiredItems: [
                    { itemId: 'artifact_singularity_core', quantity: 1 },
                    { itemId: 'exotic_temporal_crystal', quantity: 5 }
                ],
                requiredFacilities: ['quantum_lab', 'testing_chamber', 'observatory'],
                unlocks: [
                    { type: 'ability', target: 'time_dilation', description: 'Manipulate local time flow' },
                    { type: 'ability', target: 'space_folding', description: 'Fold space for instant travel' }
                ],
                isUnlocked: false,
                isResearching: false,
                researchProgress: 0,
                researchStartTime: 0
            }
        ];
        
        technologies.forEach(tech => {
            this.technologies.set(tech.id, tech);
        });
    }

    /**
     * Initialize research facilities
     */
    private initializeFacilities(): void {
        const facilities: ResearchFacility[] = [
            {
                id: 'basic_lab',
                name: 'Basic Laboratory',
                type: 'laboratory',
                efficiency: 1.0,
                specialization: [ResearchField.Engineering, ResearchField.Computing],
                maxProjects: 1,
                isOperational: true,
                currentProjects: [],
                maintenanceLevel: 1.0,
                upgradeLevel: 1
            },
            {
                id: 'workshop',
                name: 'Engineering Workshop',
                type: 'workshop',
                efficiency: 1.2,
                specialization: [ResearchField.Engineering, ResearchField.Military],
                maxProjects: 2,
                isOperational: true,
                currentProjects: [],
                maintenanceLevel: 1.0,
                upgradeLevel: 1
            },
            {
                id: 'computer_core',
                name: 'Computer Core',
                type: 'computer_core',
                efficiency: 1.5,
                specialization: [ResearchField.Computing],
                maxProjects: 1,
                isOperational: true,
                currentProjects: [],
                maintenanceLevel: 1.0,
                upgradeLevel: 1
            }
        ];
        
        facilities.forEach(facility => {
            this.facilities.set(facility.id, facility);
        });
    }

    /**
     * Initialize scientists
     */
    private initializeScientists(): void {
        const scientists: Scientist[] = [
            {
                id: 'dr_smith',
                name: 'Dr. Sarah Smith',
                expertise: ResearchField.Engineering,
                skill: 7,
                efficiency: 1.2,
                isAvailable: true,
                fatigue: 0,
                morale: 0.8
            },
            {
                id: 'prof_chen',
                name: 'Prof. Wei Chen',
                expertise: ResearchField.Physics,
                skill: 8,
                efficiency: 1.3,
                isAvailable: true,
                fatigue: 0,
                morale: 0.9
            },
            {
                id: 'dr_ivanov',
                name: 'Dr. Viktor Ivanov',
                expertise: ResearchField.Computing,
                skill: 6,
                efficiency: 1.1,
                isAvailable: true,
                fatigue: 0,
                morale: 0.7
            }
        ];
        
        scientists.forEach(scientist => {
            this.scientists.set(scientist.id, scientist);
        });
    }

    /**
     * Start research project
     */
    startResearch(technologyId: string, facilityId: string, scientistIds: string[] = []): boolean {
        const technology = this.technologies.get(technologyId);
        const facility = this.facilities.get(facilityId);
        
        if (!technology || !facility) {
            this.logger.warn('Invalid technology or facility for research', { technologyId, facilityId });
            return false;
        }
        
        // Check if technology is available for research
        if (technology.isUnlocked || technology.isResearching) {
            this.logger.warn('Technology already unlocked or being researched', { technologyId });
            return false;
        }
        
        // Check prerequisites
        for (const prereq of technology.prerequisites) {
            const prereqTech = this.technologies.get(prereq);
            if (!prereqTech || !prereqTech.isUnlocked) {
                this.logger.warn('Prerequisites not met', { technologyId, missingPrereq: prereq });
                return false;
            }
        }
        
        // Check facility availability
        if (facility.currentProjects.length >= facility.maxProjects) {
            this.logger.warn('Facility at capacity', { facilityId });
            return false;
        }
        
        // Check facility specialization
        if (facility.specialization.length > 0 && !facility.specialization.includes(technology.field)) {
            this.logger.warn('Facility not specialized for this research field', { 
                facilityId, 
                field: technology.field, 
                specializations: facility.specialization 
            });
            return false;
        }
        
        // Validate and assign scientists
        const validScientists: string[] = [];
        for (const scientistId of scientistIds) {
            const scientist = this.scientists.get(scientistId);
            if (scientist && scientist.isAvailable) {
                validScientists.push(scientistId);
                scientist.isAvailable = false;
                scientist.assignedProject = technologyId;
                scientist.assignedFacility = facilityId;
            }
        }
        
        // Calculate research efficiency
        let efficiency = facility.efficiency * facility.maintenanceLevel;
        
        // Add scientist bonuses
        validScientists.forEach(scientistId => {
            const scientist = this.scientists.get(scientistId);
            if (scientist) {
                let scientistBonus = scientist.efficiency * scientist.morale * (1 - scientist.fatigue);
                
                // Expertise bonus
                if (scientist.expertise === technology.field) {
                    scientistBonus *= 1.5;
                }
                
                efficiency += scientistBonus;
            }
        });
        
        // Apply research field multipliers
        const fieldMultiplier = this.researchMultipliers.get(technology.field) || 1.0;
        efficiency *= fieldMultiplier;
        
        // Calculate estimated completion time
        const baseTime = technology.researchTime;
        const estimatedTime = baseTime / efficiency;
        
        // Create research project
        const projectId = `project_${technologyId}_${Date.now()}`;
        const project: ResearchProject = {
            id: projectId,
            technologyId,
            facilityId,
            assignedScientists: validScientists,
            startTime: Date.now(),
            estimatedCompletion: Date.now() + estimatedTime * 1000,
            efficiency,
            status: 'active'
        };
        
        this.projects.set(projectId, project);
        facility.currentProjects.push(projectId);
        technology.isResearching = true;
        technology.researchStartTime = Date.now();
        
        this.logger.info(`🔬 Research started: ${technology.name}`, {
            facility: facility.name,
            scientists: validScientists.length,
            efficiency: efficiency.toFixed(2),
            estimatedHours: (estimatedTime / 3600).toFixed(1)
        });
        
        return true;
    }

    /**
     * Update research progress
     */
    update(deltaTime: number): void {
        const currentTime = Date.now();
        
        for (const project of this.projects.values()) {
            if (project.status !== 'active') continue;
            
            const technology = this.technologies.get(project.technologyId);
            if (!technology) continue;
            
            // Calculate progress
            const elapsed = currentTime - project.startTime;
            const totalDuration = project.estimatedCompletion - project.startTime;
            const progress = Math.min(1.0, elapsed / totalDuration);
            
            technology.researchProgress = progress;
            
            // Check for completion
            if (progress >= 1.0) {
                this.completeResearch(project.id);
            } else {
                // Update scientist fatigue
                project.assignedScientists.forEach(scientistId => {
                    const scientist = this.scientists.get(scientistId);
                    if (scientist) {
                        scientist.fatigue = Math.min(1.0, scientist.fatigue + deltaTime * 0.0001); // Gradual fatigue
                    }
                });
            }
        }
        
        // Random discovery chances
        if (Math.random() < 0.001) { // 0.1% chance per update
            this.makeRandomDiscovery();
        }
    }

    /**
     * Complete research project
     */
    private completeResearch(projectId: string): void {
        const project = this.projects.get(projectId);
        if (!project) return;
        
        const technology = this.technologies.get(project.technologyId);
        const facility = this.facilities.get(project.facilityId);
        
        if (!technology || !facility) return;
        
        // Mark technology as unlocked
        technology.isUnlocked = true;
        technology.isResearching = false;
        technology.researchProgress = 1.0;
        technology.completedTime = Date.now();
        
        // Free up scientists
        project.assignedScientists.forEach(scientistId => {
            const scientist = this.scientists.get(scientistId);
            if (scientist) {
                scientist.isAvailable = true;
                scientist.assignedProject = undefined;
                scientist.assignedFacility = undefined;
                scientist.morale = Math.min(1.0, scientist.morale + 0.1); // Boost morale on success
            }
        });
        
        // Remove project from facility
        facility.currentProjects = facility.currentProjects.filter(id => id !== projectId);
        
        // Mark project as completed
        project.status = 'completed';
        
        // Award research points
        this.totalResearchPoints += technology.researchCost;
        
        // Apply technology unlocks
        this.applyTechnologyUnlocks(technology);
        
        this.events.onTechnologyUnlocked?.(technology);
        this.events.onResearchCompleted?.(project);
        
        this.logger.info(`🎉 Research completed: ${technology.name}`, {
            duration: ((Date.now() - project.startTime) / 1000 / 60).toFixed(1) + ' minutes',
            unlocks: technology.unlocks.length
        });
        
        // Check for breakthrough achievements
        const tierCount = this.getTierUnlockCount(technology.field, technology.tier);
        if (tierCount === 1) { // First technology of this tier in this field
            this.events.onBreakthroughAchieved?.(technology.field, technology.tier);
        }
    }

    /**
     * Apply technology unlocks
     */
    private applyTechnologyUnlocks(technology: Technology): void {
        technology.unlocks.forEach(unlock => {
            switch (unlock.type) {
                case 'facility':
                    this.unlockFacility(unlock.target);
                    break;
                case 'upgrade':
                    this.applyUpgrade(unlock.target, unlock.value || 0);
                    break;
                case 'ability':
                    this.unlockAbility(unlock.target);
                    break;
                case 'recipe':
                    this.unlockRecipe(unlock.target);
                    break;
            }
        });
    }

    /**
     * Unlock new research facility
     */
    private unlockFacility(facilityType: string): void {
        const facilityConfigs: { [key: string]: Partial<ResearchFacility> } = {
            quantum_lab: {
                name: 'Quantum Research Lab',
                type: 'laboratory',
                efficiency: 2.0,
                specialization: [ResearchField.Physics, ResearchField.Computing],
                maxProjects: 2
            },
            bio_lab: {
                name: 'Biological Research Lab',
                type: 'laboratory',
                efficiency: 1.8,
                specialization: [ResearchField.Biology],
                maxProjects: 1
            },
            testing_chamber: {
                name: 'Testing Chamber',
                type: 'testing_chamber',
                efficiency: 1.5,
                specialization: [ResearchField.Military, ResearchField.Engineering],
                maxProjects: 3
            },
            observatory: {
                name: 'Deep Space Observatory',
                type: 'observatory',
                efficiency: 1.6,
                specialization: [ResearchField.Exploration, ResearchField.Physics],
                maxProjects: 1
            }
        };
        
        const config = facilityConfigs[facilityType];
        if (config) {
            const facilityId = `${facilityType}_${Date.now()}`;
            const facility: ResearchFacility = {
                id: facilityId,
                name: config.name || facilityType,
                type: config.type || 'laboratory',
                efficiency: config.efficiency || 1.0,
                specialization: config.specialization || [],
                maxProjects: config.maxProjects || 1,
                isOperational: true,
                currentProjects: [],
                maintenanceLevel: 1.0,
                upgradeLevel: 1
            };
            
            this.facilities.set(facilityId, facility);
            this.logger.info(`🏗️ New facility unlocked: ${facility.name}`);
        }
    }

    /**
     * Apply research upgrade
     */
    private applyUpgrade(upgradeType: string, value: number): void {
        switch (upgradeType) {
            case 'research_speed':
                Object.values(ResearchField).forEach(field => {
                    const current = this.researchMultipliers.get(field) || 1.0;
                    this.researchMultipliers.set(field, current * (1 + value / 100));
                });
                break;
            case 'hull_strength':
            case 'shield_capacity':
            case 'warp_efficiency':
                // These would be applied to ship systems
                this.logger.info(`⚡ Upgrade applied: ${upgradeType} +${value}%`);
                break;
        }
    }

    /**
     * Unlock new ability
     */
    private unlockAbility(abilityId: string): void {
        this.logger.info(`🌟 New ability unlocked: ${abilityId}`);
    }

    /**
     * Unlock new recipe
     */
    private unlockRecipe(recipeId: string): void {
        this.logger.info(`📋 New recipe unlocked: ${recipeId}`);
    }

    /**
     * Make random discovery
     */
    private makeRandomDiscovery(): void {
        const discoveries = [
            {
                name: 'Quantum Fluctuation Anomaly',
                field: ResearchField.Physics,
                rarity: 'rare' as const,
                researchBonus: { field: ResearchField.Physics, bonus: 0.1 }
            },
            {
                name: 'Exotic Particle Traces',
                field: ResearchField.Physics,
                rarity: 'uncommon' as const,
                grantsResources: [{ itemId: 'exotic_dark_matter', quantity: 1 }]
            },
            {
                name: 'Ancient Data Fragment',
                field: ResearchField.Computing,
                rarity: 'epic' as const,
                unlocksTechnology: 'artificial_intelligence'
            },
            {
                name: 'Biological Adaptation Pattern',
                field: ResearchField.Biology,
                rarity: 'common' as const,
                researchBonus: { field: ResearchField.Biology, bonus: 0.05 }
            }
        ];
        
        const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];
        const discoveryObj: Discovery = {
            id: `discovery_${Date.now()}`,
            name: discovery.name,
            description: `A ${discovery.rarity} discovery in ${discovery.field}`,
            field: discovery.field,
            rarity: discovery.rarity,
            discoveryTime: Date.now(),
            researchBonus: discovery.researchBonus,
            unlocksTechnology: discovery.unlocksTechnology,
            grantsResources: discovery.grantsResources
        };
        
        this.discoveries.push(discoveryObj);
        
        // Apply discovery effects
        if (discoveryObj.researchBonus) {
            const current = this.researchMultipliers.get(discoveryObj.researchBonus.field) || 1.0;
            this.researchMultipliers.set(discoveryObj.researchBonus.field, current + discoveryObj.researchBonus.bonus);
        }
        
        this.events.onDiscoveryMade?.(discoveryObj);
        
        this.logger.info(`🔍 Discovery made: ${discoveryObj.name}`, {
            field: discoveryObj.field,
            rarity: discoveryObj.rarity
        });
    }

    /**
     * Get available technologies for research
     */
    getAvailableTechnologies(): Technology[] {
        return Array.from(this.technologies.values()).filter(tech => {
            if (tech.isUnlocked || tech.isResearching) return false;
            
            // Check prerequisites
            return tech.prerequisites.every(prereqId => {
                const prereq = this.technologies.get(prereqId);
                return prereq && prereq.isUnlocked;
            });
        });
    }

    /**
     * Get active research projects
     */
    getActiveProjects(): ResearchProject[] {
        return Array.from(this.projects.values()).filter(p => p.status === 'active');
    }

    /**
     * Get unlocked technologies
     */
    getUnlockedTechnologies(): Technology[] {
        return Array.from(this.technologies.values()).filter(tech => tech.isUnlocked);
    }

    /**
     * Get technology by ID
     */
    getTechnology(technologyId: string): Technology | null {
        return this.technologies.get(technologyId) || null;
    }

    /**
     * Get all facilities
     */
    getFacilities(): ResearchFacility[] {
        return Array.from(this.facilities.values());
    }

    /**
     * Get available scientists
     */
    getAvailableScientists(): Scientist[] {
        return Array.from(this.scientists.values()).filter(s => s.isAvailable);
    }

    /**
     * Get recent discoveries
     */
    getRecentDiscoveries(limit: number = 10): Discovery[] {
        return this.discoveries
            .sort((a, b) => b.discoveryTime - a.discoveryTime)
            .slice(0, limit);
    }

    /**
     * Get tier unlock count for field
     */
    private getTierUnlockCount(field: ResearchField, tier: TechnologyTier): number {
        return Array.from(this.technologies.values())
            .filter(tech => tech.field === field && tech.tier === tier && tech.isUnlocked)
            .length;
    }

    /**
     * Get research statistics
     */
    getResearchStats(): {
        totalTechnologies: number;
        unlockedTechnologies: number;
        activeProjects: number;
        totalResearchPoints: number;
        discoveries: number;
        facilities: number;
        scientists: number;
        fieldProgress: { [field: string]: { unlocked: number, total: number } };
    } {
        const fieldProgress: { [field: string]: { unlocked: number, total: number } } = {};
        
        Object.values(ResearchField).forEach(field => {
            const technologies = Array.from(this.technologies.values()).filter(tech => tech.field === field);
            const unlocked = technologies.filter(tech => tech.isUnlocked).length;
            fieldProgress[field] = { unlocked, total: technologies.length };
        });
        
        return {
            totalTechnologies: this.technologies.size,
            unlockedTechnologies: Array.from(this.technologies.values()).filter(tech => tech.isUnlocked).length,
            activeProjects: Array.from(this.projects.values()).filter(p => p.status === 'active').length,
            totalResearchPoints: this.totalResearchPoints,
            discoveries: this.discoveries.length,
            facilities: this.facilities.size,
            scientists: this.scientists.size,
            fieldProgress
        };
    }

    /**
     * Cancel research project
     */
    cancelResearch(projectId: string): boolean {
        const project = this.projects.get(projectId);
        if (!project || project.status !== 'active') return false;
        
        const technology = this.technologies.get(project.technologyId);
        const facility = this.facilities.get(project.facilityId);
        
        if (technology) {
            technology.isResearching = false;
            technology.researchProgress = 0;
        }
        
        if (facility) {
            facility.currentProjects = facility.currentProjects.filter(id => id !== projectId);
        }
        
        // Free scientists
        project.assignedScientists.forEach(scientistId => {
            const scientist = this.scientists.get(scientistId);
            if (scientist) {
                scientist.isAvailable = true;
                scientist.assignedProject = undefined;
                scientist.assignedFacility = undefined;
            }
        });
        
        project.status = 'failed';
        
        this.logger.info(`❌ Research cancelled: ${project.technologyId}`);
        
        return true;
    }

    /**
     * Save research data
     */
    saveResearchData(): any {
        return {
            technologies: Array.from(this.technologies.entries()),
            projects: Array.from(this.projects.entries()),
            facilities: Array.from(this.facilities.entries()),
            scientists: Array.from(this.scientists.entries()),
            discoveries: this.discoveries,
            totalResearchPoints: this.totalResearchPoints,
            researchMultipliers: Array.from(this.researchMultipliers.entries())
        };
    }

    /**
     * Load research data
     */
    loadResearchData(data: any): void {
        if (data.technologies) {
            this.technologies = new Map(data.technologies);
        }
        if (data.projects) {
            this.projects = new Map(data.projects);
        }
        if (data.facilities) {
            this.facilities = new Map(data.facilities);
        }
        if (data.scientists) {
            this.scientists = new Map(data.scientists);
        }
        if (data.discoveries) {
            this.discoveries = data.discoveries;
        }
        if (data.totalResearchPoints) {
            this.totalResearchPoints = data.totalResearchPoints;
        }
        if (data.researchMultipliers) {
            this.researchMultipliers = new Map(data.researchMultipliers);
        }
        
        this.logger.info('🔬 Research data loaded', {
            technologies: this.technologies.size,
            projects: this.projects.size
        });
    }
}