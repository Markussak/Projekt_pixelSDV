/**
 * Crew Management System
 * Advanced crew mechanics with skills, assignments, morale, and ship operations
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';
import { SkillCategory } from './PlayerProgression';

export enum CrewRole {
    Captain = 'captain',
    Pilot = 'pilot',
    Engineer = 'engineer',
    Scientist = 'scientist',
    Security = 'security',
    Medic = 'medic',
    Communications = 'communications',
    Navigator = 'navigator'
}

export enum ShipStation {
    Bridge = 'bridge',
    Engineering = 'engineering',
    MedBay = 'medbay',
    ScienceLab = 'science_lab',
    WeaponsControl = 'weapons_control',
    Navigation = 'navigation',
    Communications = 'communications',
    Recreation = 'recreation'
}

export enum CrewSkill {
    Leadership = 'leadership',
    Piloting = 'piloting',
    Engineering = 'engineering',
    Science = 'science',
    Combat = 'combat',
    Medicine = 'medicine',
    Communications = 'communications',
    Navigation = 'navigation'
}

export interface CrewMember {
    id: string;
    name: string;
    role: CrewRole;
    species: string;
    age: number;
    
    // Skills (0-100)
    skills: Map<CrewSkill, number>;
    
    // Status
    health: number; // 0-100
    morale: number; // 0-100
    fatigue: number; // 0-100
    stress: number; // 0-100
    
    // Assignment
    currentStation?: ShipStation;
    assignedDuty?: string;
    workEfficiency: number; // 0-2 multiplier
    
    // Personality traits
    traits: CrewTrait[];
    preferences: CrewPreferences;
    relationships: Map<string, number>; // Other crew member ID -> relationship (-100 to 100)
    
    // Career
    experience: number;
    rank: number; // 1-10
    specializations: string[];
    commendations: string[];
    
    // Biography
    background: string;
    homeworld: string;
    joinDate: number;
}

export interface CrewTrait {
    id: string;
    name: string;
    description: string;
    effects: TraitEffect[];
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface TraitEffect {
    type: 'skill_bonus' | 'morale_bonus' | 'stress_resistance' | 'efficiency_bonus' | 'relationship_modifier';
    target?: CrewSkill | 'all';
    value: number;
    condition?: string;
}

export interface CrewPreferences {
    preferredStation: ShipStation;
    preferredShift: 'alpha' | 'beta' | 'gamma';
    personalityType: 'introvert' | 'extrovert' | 'ambivert';
    workStyle: 'methodical' | 'creative' | 'aggressive' | 'collaborative';
}

export interface StationAssignment {
    stationId: ShipStation;
    assignedCrew: string[];
    maxCrew: number;
    requiredSkills: CrewSkill[];
    efficiency: number; // Based on crew performance
    status: 'operational' | 'understaffed' | 'overstaffed' | 'unmanned';
}

export interface CrewEvent {
    id: string;
    type: 'conflict' | 'romance' | 'achievement' | 'injury' | 'discovery' | 'promotion';
    involvedCrew: string[];
    description: string;
    effects: { crewId: string, effect: string, value: number }[];
    timestamp: number;
    resolved: boolean;
}

export interface CrewManagementEvents {
    onCrewJoined?: (crew: CrewMember) => void;
    onCrewLeft?: (crew: CrewMember, reason: string) => void;
    onCrewPromoted?: (crew: CrewMember, newRank: number) => void;
    onCrewEvent?: (event: CrewEvent) => void;
    onStationEfficiencyChanged?: (station: ShipStation, efficiency: number) => void;
    onMoraleAlert?: (averageMorale: number) => void;
}

export class CrewManagement {
    private crew: Map<string, CrewMember> = new Map();
    private stations: Map<ShipStation, StationAssignment> = new Map();
    private events: CrewEvent[] = [];
    private traits: Map<string, CrewTrait> = new Map();
    
    // Ship-wide status
    private shipMorale: number = 75;
    private disciplineLevel: number = 80;
    private crewQuarters: number = 10; // Maximum crew capacity
    
    private managementEvents: CrewManagementEvents;
    private logger: Logger;

    constructor(events: CrewManagementEvents = {}) {
        this.logger = new Logger('CrewManagement');
        this.managementEvents = events;
        
        this.initializeTraits();
        this.initializeStations();
        this.initializeStartingCrew();
        
        this.logger.info('👥 Crew management system initialized');
    }

    /**
     * Initialize crew traits
     */
    private initializeTraits(): void {
        const traits: CrewTrait[] = [
            {
                id: 'veteran',
                name: 'Veteran',
                description: 'Experienced crew member with enhanced skills',
                effects: [
                    { type: 'skill_bonus', target: 'all', value: 10 },
                    { type: 'stress_resistance', value: 25 }
                ],
                rarity: 'uncommon'
            },
            {
                id: 'natural_leader',
                name: 'Natural Leader',
                description: 'Inspires confidence in fellow crew members',
                effects: [
                    { type: 'skill_bonus', target: CrewSkill.Leadership, value: 20 },
                    { type: 'morale_bonus', value: 10 }
                ],
                rarity: 'rare'
            },
            {
                id: 'genius',
                name: 'Genius',
                description: 'Exceptional intellectual capabilities',
                effects: [
                    { type: 'skill_bonus', target: CrewSkill.Science, value: 30 },
                    { type: 'efficiency_bonus', value: 50 }
                ],
                rarity: 'legendary'
            },
            {
                id: 'ace_pilot',
                name: 'Ace Pilot',
                description: 'Exceptional piloting skills',
                effects: [
                    { type: 'skill_bonus', target: CrewSkill.Piloting, value: 25 },
                    { type: 'efficiency_bonus', value: 30 }
                ],
                rarity: 'rare'
            },
            {
                id: 'workaholic',
                name: 'Workaholic',
                description: 'Works longer without fatigue',
                effects: [
                    { type: 'efficiency_bonus', value: 20 },
                    { type: 'stress_resistance', value: -10 }
                ],
                rarity: 'common'
            },
            {
                id: 'diplomatic',
                name: 'Diplomatic',
                description: 'Excellent at resolving conflicts',
                effects: [
                    { type: 'relationship_modifier', value: 15 },
                    { type: 'skill_bonus', target: CrewSkill.Communications, value: 15 }
                ],
                rarity: 'uncommon'
            },
            {
                id: 'combat_veteran',
                name: 'Combat Veteran',
                description: 'Experienced in combat situations',
                effects: [
                    { type: 'skill_bonus', target: CrewSkill.Combat, value: 20 },
                    { type: 'stress_resistance', value: 20 }
                ],
                rarity: 'uncommon'
            },
            {
                id: 'perfectionist',
                name: 'Perfectionist',
                description: 'Produces higher quality work but slower',
                effects: [
                    { type: 'efficiency_bonus', value: 25 },
                    { type: 'stress_resistance', value: -15 }
                ],
                rarity: 'common'
            }
        ];
        
        traits.forEach(trait => {
            this.traits.set(trait.id, trait);
        });
    }

    /**
     * Initialize ship stations
     */
    private initializeStations(): void {
        const stationConfigs: Array<{
            station: ShipStation,
            maxCrew: number,
            requiredSkills: CrewSkill[]
        }> = [
            {
                station: ShipStation.Bridge,
                maxCrew: 3,
                requiredSkills: [CrewSkill.Leadership, CrewSkill.Navigation]
            },
            {
                station: ShipStation.Engineering,
                maxCrew: 4,
                requiredSkills: [CrewSkill.Engineering]
            },
            {
                station: ShipStation.MedBay,
                maxCrew: 2,
                requiredSkills: [CrewSkill.Medicine]
            },
            {
                station: ShipStation.ScienceLab,
                maxCrew: 3,
                requiredSkills: [CrewSkill.Science]
            },
            {
                station: ShipStation.WeaponsControl,
                maxCrew: 2,
                requiredSkills: [CrewSkill.Combat]
            },
            {
                station: ShipStation.Navigation,
                maxCrew: 2,
                requiredSkills: [CrewSkill.Navigation, CrewSkill.Piloting]
            },
            {
                station: ShipStation.Communications,
                maxCrew: 1,
                requiredSkills: [CrewSkill.Communications]
            },
            {
                station: ShipStation.Recreation,
                maxCrew: 1,
                requiredSkills: []
            }
        ];
        
        stationConfigs.forEach(config => {
            this.stations.set(config.station, {
                stationId: config.station,
                assignedCrew: [],
                maxCrew: config.maxCrew,
                requiredSkills: config.requiredSkills,
                efficiency: 0,
                status: 'unmanned'
            });
        });
    }

    /**
     * Initialize starting crew
     */
    private initializeStartingCrew(): void {
        const startingCrew = [
            {
                name: 'Commander Sarah Cross',
                role: CrewRole.Captain,
                species: 'Human',
                skills: new Map([
                    [CrewSkill.Leadership, 85],
                    [CrewSkill.Navigation, 70],
                    [CrewSkill.Combat, 60]
                ]),
                traits: ['natural_leader'],
                preferredStation: ShipStation.Bridge
            },
            {
                name: 'Lieutenant Marcus Reid',
                role: CrewRole.Pilot,
                species: 'Human',
                skills: new Map([
                    [CrewSkill.Piloting, 90],
                    [CrewSkill.Navigation, 75],
                    [CrewSkill.Engineering, 45]
                ]),
                traits: ['ace_pilot'],
                preferredStation: ShipStation.Navigation
            },
            {
                name: 'Chief Engineer Zara Voss',
                role: CrewRole.Engineer,
                species: 'Centaurian',
                skills: new Map([
                    [CrewSkill.Engineering, 88],
                    [CrewSkill.Science, 65],
                    [CrewSkill.Combat, 30]
                ]),
                traits: ['perfectionist'],
                preferredStation: ShipStation.Engineering
            },
            {
                name: 'Dr. Elena Vasquez',
                role: CrewRole.Medic,
                species: 'Human',
                skills: new Map([
                    [CrewSkill.Medicine, 85],
                    [CrewSkill.Science, 70],
                    [CrewSkill.Communications, 55]
                ]),
                traits: ['diplomatic'],
                preferredStation: ShipStation.MedBay
            }
        ];
        
        startingCrew.forEach((crewData, index) => {
            const crew = this.createCrewMember(
                crewData.name,
                crewData.role,
                crewData.species,
                crewData.skills,
                crewData.traits,
                crewData.preferredStation
            );
            this.addCrewMember(crew);
        });
    }

    /**
     * Create new crew member
     */
    private createCrewMember(
        name: string,
        role: CrewRole,
        species: string,
        skills: Map<CrewSkill, number>,
        traitIds: string[] = [],
        preferredStation?: ShipStation
    ): CrewMember {
        const crewId = `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize all skills
        const allSkills = new Map<CrewSkill, number>();
        Object.values(CrewSkill).forEach(skill => {
            allSkills.set(skill, skills.get(skill) || Math.floor(Math.random() * 30) + 20);
        });
        
        // Apply trait bonuses
        const memberTraits: CrewTrait[] = [];
        traitIds.forEach(traitId => {
            const trait = this.traits.get(traitId);
            if (trait) {
                memberTraits.push(trait);
                trait.effects.forEach(effect => {
                    if (effect.type === 'skill_bonus') {
                        if (effect.target === 'all') {
                            Object.values(CrewSkill).forEach(skill => {
                                const current = allSkills.get(skill) || 0;
                                allSkills.set(skill, Math.min(100, current + effect.value));
                            });
                        } else if (effect.target) {
                            const current = allSkills.get(effect.target as CrewSkill) || 0;
                            allSkills.set(effect.target as CrewSkill, Math.min(100, current + effect.value));
                        }
                    }
                });
            }
        });
        
        return {
            id: crewId,
            name,
            role,
            species,
            age: Math.floor(Math.random() * 40) + 25,
            
            skills: allSkills,
            
            health: 100,
            morale: Math.floor(Math.random() * 20) + 70, // 70-90
            fatigue: Math.floor(Math.random() * 20) + 10, // 10-30
            stress: Math.floor(Math.random() * 15) + 5, // 5-20
            
            workEfficiency: 1.0,
            
            traits: memberTraits,
            preferences: {
                preferredStation: preferredStation || ShipStation.Bridge,
                preferredShift: 'alpha',
                personalityType: ['introvert', 'extrovert', 'ambivert'][Math.floor(Math.random() * 3)] as any,
                workStyle: ['methodical', 'creative', 'aggressive', 'collaborative'][Math.floor(Math.random() * 4)] as any
            },
            relationships: new Map(),
            
            experience: Math.floor(Math.random() * 1000) + 500,
            rank: Math.floor(Math.random() * 3) + 1,
            specializations: [],
            commendations: [],
            
            background: this.generateBackground(species, role),
            homeworld: this.generateHomeworld(species),
            joinDate: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date in past year
        };
    }

    /**
     * Generate crew background
     */
    private generateBackground(species: string, role: CrewRole): string {
        const backgrounds = {
            [CrewRole.Captain]: ['Former military officer', 'Merchant marine veteran', 'Academy graduate'],
            [CrewRole.Pilot]: ['Test pilot', 'Racing pilot', 'Military pilot', 'Civilian transport pilot'],
            [CrewRole.Engineer]: ['Shipyard worker', 'Research scientist', 'Maintenance chief', 'Technical specialist'],
            [CrewRole.Scientist]: ['University researcher', 'Corporate scientist', 'Field researcher', 'Lab technician'],
            [CrewRole.Security]: ['Military police', 'Corporate security', 'Bounty hunter', 'Law enforcement'],
            [CrewRole.Medic]: ['Ship surgeon', 'Emergency medic', 'Research physician', 'Field medic'],
            [CrewRole.Communications]: ['Signal analyst', 'Diplomatic attaché', 'Communications officer', 'Intelligence operative'],
            [CrewRole.Navigator]: ['Star chart cartographer', 'Deep space navigator', 'Survey specialist', 'Astrogation expert']
        };
        
        const roleBackgrounds = backgrounds[role] || ['General crew member'];
        return roleBackgrounds[Math.floor(Math.random() * roleBackgrounds.length)];
    }

    /**
     * Generate homeworld
     */
    private generateHomeworld(species: string): string {
        const homeworlds = {
            'Human': ['Earth', 'Mars', 'Alpha Centauri', 'New Terra', 'Proxima Station'],
            'Centaurian': ['Centauri Prime', 'Alpha Station', 'Proxima Colony'],
            'Vulcan': ['Vulcan', 'New Vulcan', 'Vulcan Colony Alpha'],
            'Andorian': ['Andoria', 'Andorian Outpost', 'Ice Station Beta']
        };
        
        const speciesWorlds = homeworlds[species] || homeworlds['Human'];
        return speciesWorlds[Math.floor(Math.random() * speciesWorlds.length)];
    }

    /**
     * Add crew member to ship
     */
    addCrewMember(crew: CrewMember): boolean {
        if (this.crew.size >= this.crewQuarters) {
            this.logger.warn('Cannot add crew member: quarters at capacity');
            return false;
        }
        
        this.crew.set(crew.id, crew);
        
        // Initialize relationships with existing crew
        for (const existingCrew of this.crew.values()) {
            if (existingCrew.id !== crew.id) {
                const relationship = this.calculateInitialRelationship(crew, existingCrew);
                crew.relationships.set(existingCrew.id, relationship);
                existingCrew.relationships.set(crew.id, relationship);
            }
        }
        
        this.managementEvents.onCrewJoined?.(crew);
        
        this.logger.info(`👤 Crew member joined: ${crew.name}`, {
            role: crew.role,
            species: crew.species,
            traits: crew.traits.map(t => t.name)
        });
        
        return true;
    }

    /**
     * Calculate initial relationship between crew members
     */
    private calculateInitialRelationship(crew1: CrewMember, crew2: CrewMember): number {
        let relationship = 0;
        
        // Species compatibility
        if (crew1.species === crew2.species) {
            relationship += 10;
        }
        
        // Personality compatibility
        if (crew1.preferences.personalityType === crew2.preferences.personalityType) {
            relationship += 5;
        }
        
        // Work style compatibility
        if (crew1.preferences.workStyle === crew2.preferences.workStyle) {
            relationship += 5;
        } else if (
            (crew1.preferences.workStyle === 'collaborative' || crew2.preferences.workStyle === 'collaborative') &&
            crew1.preferences.workStyle !== 'aggressive' && crew2.preferences.workStyle !== 'aggressive'
        ) {
            relationship += 3;
        }
        
        // Random factor
        relationship += Math.floor(Math.random() * 21) - 10; // -10 to +10
        
        return Math.max(-50, Math.min(50, relationship)); // Clamp to -50 to +50
    }

    /**
     * Assign crew member to station
     */
    assignCrewToStation(crewId: string, station: ShipStation): boolean {
        const crew = this.crew.get(crewId);
        const stationData = this.stations.get(station);
        
        if (!crew || !stationData) {
            this.logger.warn('Invalid crew or station for assignment', { crewId, station });
            return false;
        }
        
        // Remove from current station
        if (crew.currentStation) {
            this.removeCrewFromStation(crewId, crew.currentStation);
        }
        
        // Check capacity
        if (stationData.assignedCrew.length >= stationData.maxCrew) {
            this.logger.warn('Station at capacity', { station });
            return false;
        }
        
        // Assign to new station
        crew.currentStation = station;
        stationData.assignedCrew.push(crewId);
        
        // Calculate work efficiency based on skills and preferences
        crew.workEfficiency = this.calculateWorkEfficiency(crew, station);
        
        // Update station efficiency
        this.updateStationEfficiency(station);
        
        this.logger.info(`👥 Crew assigned: ${crew.name} → ${station}`, {
            efficiency: crew.workEfficiency.toFixed(2)
        });
        
        return true;
    }

    /**
     * Remove crew from station
     */
    private removeCrewFromStation(crewId: string, station: ShipStation): void {
        const stationData = this.stations.get(station);
        if (stationData) {
            stationData.assignedCrew = stationData.assignedCrew.filter(id => id !== crewId);
            this.updateStationEfficiency(station);
        }
        
        const crew = this.crew.get(crewId);
        if (crew) {
            crew.currentStation = undefined;
            crew.workEfficiency = 1.0;
        }
    }

    /**
     * Calculate work efficiency for crew at station
     */
    private calculateWorkEfficiency(crew: CrewMember, station: ShipStation): number {
        let efficiency = 1.0;
        
        // Skill-based efficiency
        const stationData = this.stations.get(station);
        if (stationData) {
            let skillTotal = 0;
            let skillCount = 0;
            
            stationData.requiredSkills.forEach(skill => {
                const skillLevel = crew.skills.get(skill) || 0;
                skillTotal += skillLevel;
                skillCount++;
            });
            
            if (skillCount > 0) {
                const averageSkill = skillTotal / skillCount;
                efficiency = 0.5 + (averageSkill / 100) * 1.5; // 0.5 to 2.0 range
            }
        }
        
        // Preference bonus
        if (crew.preferences.preferredStation === station) {
            efficiency *= 1.2;
        }
        
        // Health and morale effects
        efficiency *= (crew.health / 100);
        efficiency *= (crew.morale / 100);
        efficiency *= (1 - crew.fatigue / 200); // Fatigue has less impact
        efficiency *= (1 - crew.stress / 150); // Stress has moderate impact
        
        // Trait effects
        crew.traits.forEach(trait => {
            trait.effects.forEach(effect => {
                if (effect.type === 'efficiency_bonus') {
                    efficiency *= (1 + effect.value / 100);
                }
            });
        });
        
        return Math.max(0.1, Math.min(2.5, efficiency)); // Clamp to 0.1-2.5
    }

    /**
     * Update station efficiency based on assigned crew
     */
    private updateStationEfficiency(station: ShipStation): void {
        const stationData = this.stations.get(station);
        if (!stationData) return;
        
        if (stationData.assignedCrew.length === 0) {
            stationData.efficiency = 0;
            stationData.status = 'unmanned';
        } else {
            let totalEfficiency = 0;
            let crewCount = 0;
            
            stationData.assignedCrew.forEach(crewId => {
                const crew = this.crew.get(crewId);
                if (crew) {
                    totalEfficiency += crew.workEfficiency;
                    crewCount++;
                }
            });
            
            if (crewCount > 0) {
                stationData.efficiency = totalEfficiency / crewCount;
                
                // Determine status
                const optimalCrew = Math.ceil(stationData.maxCrew * 0.75);
                if (crewCount < optimalCrew) {
                    stationData.status = 'understaffed';
                } else if (crewCount > stationData.maxCrew) {
                    stationData.status = 'overstaffed';
                    stationData.efficiency *= 0.8; // Overcrowding penalty
                } else {
                    stationData.status = 'operational';
                }
            }
        }
        
        this.managementEvents.onStationEfficiencyChanged?.(station, stationData.efficiency);
    }

    /**
     * Update crew system
     */
    update(deltaTime: number): void {
        this.updateCrewStatus(deltaTime);
        this.updateRelationships(deltaTime);
        this.checkCrewEvents();
        this.updateShipMorale();
    }

    /**
     * Update crew status (health, morale, fatigue, stress)
     */
    private updateCrewStatus(deltaTime: number): void {
        for (const crew of this.crew.values()) {
            // Fatigue increases during work
            if (crew.currentStation) {
                crew.fatigue = Math.min(100, crew.fatigue + deltaTime * 0.02);
            } else {
                // Rest reduces fatigue
                crew.fatigue = Math.max(0, crew.fatigue - deltaTime * 0.05);
            }
            
            // Stress management
            let stressChange = 0;
            
            // Work stress
            if (crew.currentStation) {
                const stationData = this.stations.get(crew.currentStation);
                if (stationData && stationData.status === 'understaffed') {
                    stressChange += deltaTime * 0.03;
                }
            }
            
            // Relationship stress
            let relationshipStress = 0;
            let relationshipCount = 0;
            crew.relationships.forEach(relationship => {
                relationshipStress += relationship;
                relationshipCount++;
            });
            
            if (relationshipCount > 0) {
                const avgRelationship = relationshipStress / relationshipCount;
                if (avgRelationship < -20) {
                    stressChange += deltaTime * 0.02;
                } else if (avgRelationship > 20) {
                    stressChange -= deltaTime * 0.01;
                }
            }
            
            // Apply trait effects
            crew.traits.forEach(trait => {
                trait.effects.forEach(effect => {
                    if (effect.type === 'stress_resistance') {
                        stressChange *= (1 - effect.value / 100);
                    }
                });
            });
            
            crew.stress = Math.max(0, Math.min(100, crew.stress + stressChange));
            
            // Morale calculation
            let moraleChange = 0;
            
            // Base morale decay
            moraleChange -= deltaTime * 0.01;
            
            // Station assignment morale
            if (crew.currentStation === crew.preferences.preferredStation) {
                moraleChange += deltaTime * 0.02;
            }
            
            // Health affects morale
            if (crew.health < 80) {
                moraleChange -= deltaTime * 0.015;
            }
            
            // Stress affects morale
            if (crew.stress > 60) {
                moraleChange -= deltaTime * 0.02;
            }
            
            // Apply trait effects
            crew.traits.forEach(trait => {
                trait.effects.forEach(effect => {
                    if (effect.type === 'morale_bonus') {
                        moraleChange += deltaTime * (effect.value / 1000);
                    }
                });
            });
            
            crew.morale = Math.max(0, Math.min(100, crew.morale + moraleChange));
            
            // Update work efficiency
            if (crew.currentStation) {
                crew.workEfficiency = this.calculateWorkEfficiency(crew, crew.currentStation);
            }
        }
    }

    /**
     * Update crew relationships
     */
    private updateRelationships(deltaTime: number): void {
        const crewArray = Array.from(this.crew.values());
        
        for (let i = 0; i < crewArray.length; i++) {
            for (let j = i + 1; j < crewArray.length; j++) {
                const crew1 = crewArray[i];
                const crew2 = crewArray[j];
                
                // Working together improves relationships slowly
                if (crew1.currentStation === crew2.currentStation && crew1.currentStation) {
                    const improvement = deltaTime * 0.005;
                    this.modifyRelationship(crew1.id, crew2.id, improvement);
                }
                
                // Random small relationship changes
                if (Math.random() < 0.001) { // Very rare random events
                    const change = (Math.random() - 0.5) * 2; // -1 to +1
                    this.modifyRelationship(crew1.id, crew2.id, change);
                }
            }
        }
    }

    /**
     * Modify relationship between two crew members
     */
    private modifyRelationship(crewId1: string, crewId2: string, change: number): void {
        const crew1 = this.crew.get(crewId1);
        const crew2 = this.crew.get(crewId2);
        
        if (!crew1 || !crew2) return;
        
        const current1 = crew1.relationships.get(crewId2) || 0;
        const current2 = crew2.relationships.get(crewId1) || 0;
        
        crew1.relationships.set(crewId2, Math.max(-100, Math.min(100, current1 + change)));
        crew2.relationships.set(crewId1, Math.max(-100, Math.min(100, current2 + change)));
    }

    /**
     * Check for random crew events
     */
    private checkCrewEvents(): void {
        if (Math.random() < 0.0005) { // Very rare events
            this.generateCrewEvent();
        }
    }

    /**
     * Generate random crew event
     */
    private generateCrewEvent(): void {
        const crewArray = Array.from(this.crew.values());
        if (crewArray.length < 2) return;
        
        const eventTypes = ['conflict', 'achievement', 'discovery', 'promotion'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)] as CrewEvent['type'];
        
        let event: CrewEvent;
        
        switch (eventType) {
            case 'conflict':
                event = this.generateConflictEvent(crewArray);
                break;
            case 'achievement':
                event = this.generateAchievementEvent(crewArray);
                break;
            case 'discovery':
                event = this.generateDiscoveryEvent(crewArray);
                break;
            case 'promotion':
                event = this.generatePromotionEvent(crewArray);
                break;
            default:
                return;
        }
        
        this.events.push(event);
        this.managementEvents.onCrewEvent?.(event);
        
        // Apply event effects
        event.effects.forEach(effect => {
            const crew = this.crew.get(effect.crewId);
            if (crew) {
                switch (effect.effect) {
                    case 'morale':
                        crew.morale = Math.max(0, Math.min(100, crew.morale + effect.value));
                        break;
                    case 'stress':
                        crew.stress = Math.max(0, Math.min(100, crew.stress + effect.value));
                        break;
                    case 'experience':
                        crew.experience += effect.value;
                        break;
                }
            }
        });
        
        this.logger.info(`📰 Crew event: ${event.description}`, {
            type: event.type,
            involvedCrew: event.involvedCrew.length
        });
    }

    /**
     * Generate conflict event
     */
    private generateConflictEvent(crewArray: CrewMember[]): CrewEvent {
        const crew1 = crewArray[Math.floor(Math.random() * crewArray.length)];
        const crew2 = crewArray[Math.floor(Math.random() * crewArray.length)];
        
        if (crew1.id === crew2.id) {
            return this.generateConflictEvent(crewArray); // Retry
        }
        
        const conflictTypes = [
            'disagreement over procedures',
            'personality clash',
            'resource allocation dispute',
            'work methodology conflict'
        ];
        
        const conflictType = conflictTypes[Math.floor(Math.random() * conflictTypes.length)];
        
        return {
            id: `event_${Date.now()}`,
            type: 'conflict',
            involvedCrew: [crew1.id, crew2.id],
            description: `${crew1.name} and ${crew2.name} had a ${conflictType}`,
            effects: [
                { crewId: crew1.id, effect: 'morale', value: -10 },
                { crewId: crew2.id, effect: 'morale', value: -10 },
                { crewId: crew1.id, effect: 'stress', value: 15 },
                { crewId: crew2.id, effect: 'stress', value: 15 }
            ],
            timestamp: Date.now(),
            resolved: false
        };
    }

    /**
     * Generate achievement event
     */
    private generateAchievementEvent(crewArray: CrewMember[]): CrewEvent {
        const crew = crewArray[Math.floor(Math.random() * crewArray.length)];
        
        const achievements = [
            'exceptional performance during crisis',
            'innovative solution to technical problem',
            'outstanding leadership during difficult situation',
            'breakthrough in research project'
        ];
        
        const achievement = achievements[Math.floor(Math.random() * achievements.length)];
        
        return {
            id: `event_${Date.now()}`,
            type: 'achievement',
            involvedCrew: [crew.id],
            description: `${crew.name} demonstrated ${achievement}`,
            effects: [
                { crewId: crew.id, effect: 'morale', value: 20 },
                { crewId: crew.id, effect: 'experience', value: 100 }
            ],
            timestamp: Date.now(),
            resolved: true
        };
    }

    /**
     * Generate discovery event
     */
    private generateDiscoveryEvent(crewArray: CrewMember[]): CrewEvent {
        const crew = crewArray[Math.floor(Math.random() * crewArray.length)];
        
        const discoveries = [
            'discovered new mineral composition',
            'identified unknown signal pattern',
            'found evidence of ancient civilization',
            'detected rare astronomical phenomenon'
        ];
        
        const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];
        
        return {
            id: `event_${Date.now()}`,
            type: 'discovery',
            involvedCrew: [crew.id],
            description: `${crew.name} ${discovery}`,
            effects: [
                { crewId: crew.id, effect: 'morale', value: 15 },
                { crewId: crew.id, effect: 'experience', value: 75 }
            ],
            timestamp: Date.now(),
            resolved: true
        };
    }

    /**
     * Generate promotion event
     */
    private generatePromotionEvent(crewArray: CrewMember[]): CrewEvent {
        const eligibleCrew = crewArray.filter(crew => crew.rank < 10 && crew.experience > 1000);
        if (eligibleCrew.length === 0) return this.generateAchievementEvent(crewArray);
        
        const crew = eligibleCrew[Math.floor(Math.random() * eligibleCrew.length)];
        crew.rank++;
        
        return {
            id: `event_${Date.now()}`,
            type: 'promotion',
            involvedCrew: [crew.id],
            description: `${crew.name} has been promoted to rank ${crew.rank}`,
            effects: [
                { crewId: crew.id, effect: 'morale', value: 25 }
            ],
            timestamp: Date.now(),
            resolved: true
        };
    }

    /**
     * Update ship-wide morale
     */
    private updateShipMorale(): void {
        if (this.crew.size === 0) {
            this.shipMorale = 50;
            return;
        }
        
        let totalMorale = 0;
        for (const crew of this.crew.values()) {
            totalMorale += crew.morale;
        }
        
        const averageMorale = totalMorale / this.crew.size;
        
        // Smooth transition
        this.shipMorale = this.shipMorale * 0.9 + averageMorale * 0.1;
        
        // Check for morale alerts
        if (this.shipMorale < 40) {
            this.managementEvents.onMoraleAlert?.(this.shipMorale);
        }
    }

    /**
     * Get crew member by ID
     */
    getCrewMember(crewId: string): CrewMember | null {
        return this.crew.get(crewId) || null;
    }

    /**
     * Get all crew members
     */
    getAllCrew(): CrewMember[] {
        return Array.from(this.crew.values());
    }

    /**
     * Get crew by role
     */
    getCrewByRole(role: CrewRole): CrewMember[] {
        return Array.from(this.crew.values()).filter(crew => crew.role === role);
    }

    /**
     * Get crew by station
     */
    getCrewByStation(station: ShipStation): CrewMember[] {
        return Array.from(this.crew.values()).filter(crew => crew.currentStation === station);
    }

    /**
     * Get station information
     */
    getStation(station: ShipStation): StationAssignment | null {
        return this.stations.get(station) || null;
    }

    /**
     * Get all stations
     */
    getAllStations(): StationAssignment[] {
        return Array.from(this.stations.values());
    }

    /**
     * Get recent crew events
     */
    getRecentEvents(limit: number = 10): CrewEvent[] {
        return this.events
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get crew management statistics
     */
    getCrewStats(): {
        totalCrew: number;
        maxCrew: number;
        averageMorale: number;
        averageHealth: number;
        averageFatigue: number;
        averageStress: number;
        stationEfficiency: { [station: string]: number };
        roleDistribution: { [role: string]: number };
        shipMorale: number;
        disciplineLevel: number;
    } {
        const totalCrew = this.crew.size;
        const maxCrew = this.crewQuarters;
        
        let totalMorale = 0;
        let totalHealth = 0;
        let totalFatigue = 0;
        let totalStress = 0;
        
        const roleDistribution: { [role: string]: number } = {};
        
        for (const crew of this.crew.values()) {
            totalMorale += crew.morale;
            totalHealth += crew.health;
            totalFatigue += crew.fatigue;
            totalStress += crew.stress;
            
            roleDistribution[crew.role] = (roleDistribution[crew.role] || 0) + 1;
        }
        
        const stationEfficiency: { [station: string]: number } = {};
        for (const [station, data] of this.stations.entries()) {
            stationEfficiency[station] = data.efficiency;
        }
        
        return {
            totalCrew,
            maxCrew,
            averageMorale: totalCrew > 0 ? totalMorale / totalCrew : 0,
            averageHealth: totalCrew > 0 ? totalHealth / totalCrew : 0,
            averageFatigue: totalCrew > 0 ? totalFatigue / totalCrew : 0,
            averageStress: totalCrew > 0 ? totalStress / totalCrew : 0,
            stationEfficiency,
            roleDistribution,
            shipMorale: this.shipMorale,
            disciplineLevel: this.disciplineLevel
        };
    }

    /**
     * Save crew data
     */
    saveCrewData(): any {
        return {
            crew: Array.from(this.crew.entries()).map(([id, crew]) => [
                id,
                {
                    ...crew,
                    skills: Array.from(crew.skills.entries()),
                    relationships: Array.from(crew.relationships.entries())
                }
            ]),
            stations: Array.from(this.stations.entries()),
            events: this.events,
            shipMorale: this.shipMorale,
            disciplineLevel: this.disciplineLevel,
            crewQuarters: this.crewQuarters
        };
    }

    /**
     * Load crew data
     */
    loadCrewData(data: any): void {
        if (data.crew) {
            this.crew = new Map(data.crew.map(([id, crew]: [string, any]) => [
                id,
                {
                    ...crew,
                    skills: new Map(crew.skills),
                    relationships: new Map(crew.relationships)
                }
            ]));
        }
        if (data.stations) {
            this.stations = new Map(data.stations);
        }
        if (data.events) {
            this.events = data.events;
        }
        if (data.shipMorale !== undefined) {
            this.shipMorale = data.shipMorale;
        }
        if (data.disciplineLevel !== undefined) {
            this.disciplineLevel = data.disciplineLevel;
        }
        if (data.crewQuarters !== undefined) {
            this.crewQuarters = data.crewQuarters;
        }
        
        this.logger.info('👥 Crew data loaded', {
            crewCount: this.crew.size,
            events: this.events.length
        });
    }
}