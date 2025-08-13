/**
 * Alien AI System
 * Advanced alien behaviors, species characteristics, and interactions
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';
import { Faction, DiplomaticStance } from '@diplomacy/DiplomacySystem';

export enum AlienSpecies {
    Zephyrian = 'zephyrian',
    Crystalline = 'crystalline',
    Ethereal = 'ethereal',
    Mechanical = 'mechanical',
    Hive = 'hive',
    Energy = 'energy',
    Aquatic = 'aquatic',
    Silicon = 'silicon'
}

export enum AlienBehaviorType {
    Peaceful = 'peaceful',
    Aggressive = 'aggressive',
    Curious = 'curious',
    Isolationist = 'isolationist',
    Expansionist = 'expansionist',
    Trader = 'trader',
    Scholar = 'scholar',
    Guardian = 'guardian'
}

export enum CommunicationMethod {
    Verbal = 'verbal',
    Telepathic = 'telepathic',
    Chemical = 'chemical',
    Light = 'light',
    Electromagnetic = 'electromagnetic',
    Quantum = 'quantum',
    Gestural = 'gestural',
    Mathematical = 'mathematical'
}

export interface AlienSpeciesProfile {
    species: AlienSpecies;
    name: string;
    description: string;
    
    // Physical characteristics
    physiology: {
        size: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
        composition: 'organic' | 'silicon' | 'crystalline' | 'energy' | 'mechanical';
        lifespan: number; // Years
        temperature: 'cryogenic' | 'cold' | 'temperate' | 'hot' | 'plasma';
        environment: 'vacuum' | 'atmosphere' | 'liquid' | 'plasma' | 'quantum';
    };
    
    // Cultural traits
    culture: {
        government: 'collective' | 'hierarchical' | 'anarchic' | 'democratic' | 'theocratic';
        values: string[];
        taboos: string[];
        rituals: string[];
        artForms: string[];
    };
    
    // Communication
    communication: {
        primary: CommunicationMethod;
        secondary: CommunicationMethod[];
        linguisticComplexity: number; // 1-10
        translationDifficulty: number; // 1-10
        emotionalRange: string[];
    };
    
    // Technology
    technology: {
        level: number; // 1-10
        specializations: string[];
        weaknesses: string[];
        uniqueTech: string[];
        energySource: string;
    };
    
    // Psychology
    psychology: {
        intelligence: number; // 1-10
        emotionalStability: number; // 1-10
        socialComplexity: number; // 1-10
        memoryType: 'short' | 'long' | 'perfect' | 'collective';
        decisionMaking: 'logical' | 'emotional' | 'intuitive' | 'collective';
    };
    
    // Behavior patterns
    behaviorPatterns: {
        primary: AlienBehaviorType;
        secondary: AlienBehaviorType[];
        aggressionTriggers: string[];
        friendshipFactors: string[];
        fearFactors: string[];
    };
}

export interface AlienEncounter {
    id: string;
    species: AlienSpecies;
    type: 'first_contact' | 'routine' | 'scientific' | 'territorial' | 'distress' | 'probe';
    location: { x: number, y: number };
    
    // Encounter state
    phase: 'approach' | 'contact' | 'communication' | 'interaction' | 'resolution';
    intensity: number; // 0-100
    suspicion: number; // 0-100
    interest: number; // 0-100
    
    // Communication state
    communicationEstablished: boolean;
    languageBarrier: number; // 0-100, reduces over time
    translationProgress: number; // 0-100
    culturalUnderstanding: number; // 0-100
    
    // Interaction history
    actions: AlienAction[];
    responses: AlienResponse[];
    
    // Outcome tracking
    success: boolean;
    knowledge_gained: string[];
    technology_exchanged: string[];
    cultural_insights: string[];
    
    timestamp: number;
    duration: number;
}

export interface AlienAction {
    id: string;
    type: 'scan' | 'communicate' | 'approach' | 'retreat' | 'gift' | 'demonstrate' | 'threaten' | 'probe';
    description: string;
    timestamp: number;
    
    // Action parameters
    intensity: number;
    complexity: number;
    risk: number;
    
    // Expected outcomes
    expectedResponse: string[];
    culturalContext?: string;
}

export interface AlienResponse {
    actionId: string;
    type: 'positive' | 'negative' | 'neutral' | 'confused' | 'curious' | 'hostile';
    description: string;
    intensity: number;
    
    // Response context
    culturalReason?: string;
    technologicalFactor?: string;
    psychologicalState: string;
}

export interface AlienKnowledge {
    species: AlienSpecies;
    
    // Known information
    physicalTraits: string[];
    culturalTraits: string[];
    technologicalCapabilities: string[];
    communicationMethods: string[];
    behaviorPatterns: string[];
    
    // Understanding levels
    languageComprehension: number; // 0-100
    culturalUnderstanding: number; // 0-100
    technologicalUnderstanding: number; // 0-100
    psychologicalProfile: number; // 0-100
    
    // Interaction history
    totalContacts: number;
    successfulCommunications: number;
    hostileEncounters: number;
    peacefulEncounters: number;
    
    // Research progress
    researchPoints: number;
    discoveredSecrets: string[];
    unlockedTechnologies: string[];
    
    lastUpdate: number;
}

export interface AlienEvents {
    onFirstContact?: (species: AlienSpecies, encounter: AlienEncounter) => void;
    onCommunicationBreakthrough?: (species: AlienSpecies, method: CommunicationMethod) => void;
    onTechnologyDiscovered?: (species: AlienSpecies, technology: string) => void;
    onCulturalInsight?: (species: AlienSpecies, insight: string) => void;
    onHostileAction?: (species: AlienSpecies, action: AlienAction) => void;
    onAllianceOpportunity?: (species: AlienSpecies) => void;
}

export class AlienAI {
    private speciesProfiles: Map<AlienSpecies, AlienSpeciesProfile> = new Map();
    private activeEncounters: Map<string, AlienEncounter> = new Map();
    private knowledgeBase: Map<AlienSpecies, AlienKnowledge> = new Map();
    
    // AI behavior state
    private encounterPatterns: Map<AlienSpecies, number[]> = new Map();
    private adaptiveBehaviors: Map<AlienSpecies, Map<string, number>> = new Map();
    
    private events: AlienEvents;
    private logger: Logger;

    constructor(events: AlienEvents = {}) {
        this.logger = new Logger('AlienAI');
        this.events = events;
        
        this.initializeSpeciesProfiles();
        this.initializeKnowledgeBase();
        
        this.logger.info('👽 Alien AI system initialized');
    }

    /**
     * Initialize alien species profiles
     */
    private initializeSpeciesProfiles(): void {
        const profiles: AlienSpeciesProfile[] = [
            {
                species: AlienSpecies.Zephyrian,
                name: 'Zephyrians',
                description: 'Ancient crystalline beings with advanced psionic abilities',
                physiology: {
                    size: 'large',
                    composition: 'crystalline',
                    lifespan: 10000,
                    temperature: 'cold',
                    environment: 'atmosphere'
                },
                culture: {
                    government: 'hierarchical',
                    values: ['knowledge', 'tradition', 'order', 'perfection'],
                    taboos: ['chaos', 'destruction of crystals', 'emotional outbursts'],
                    rituals: ['crystal resonance ceremonies', 'memory sharing'],
                    artForms: ['harmonic sculptures', 'light patterns', 'crystal gardens']
                },
                communication: {
                    primary: CommunicationMethod.Telepathic,
                    secondary: [CommunicationMethod.Light, CommunicationMethod.Electromagnetic],
                    linguisticComplexity: 9,
                    translationDifficulty: 8,
                    emotionalRange: ['serenity', 'contemplation', 'ancient_wisdom', 'ethereal_beauty']
                },
                technology: {
                    level: 10,
                    specializations: ['psionics', 'crystalline_tech', 'energy_manipulation', 'consciousness_transfer'],
                    weaknesses: ['mechanical_systems', 'rapid_adaptation'],
                    uniqueTech: ['crystal_matrices', 'psionic_amplifiers', 'temporal_perception'],
                    energySource: 'stellar_radiation'
                },
                psychology: {
                    intelligence: 10,
                    emotionalStability: 8,
                    socialComplexity: 9,
                    memoryType: 'perfect',
                    decisionMaking: 'logical'
                },
                behaviorPatterns: {
                    primary: AlienBehaviorType.Scholar,
                    secondary: [AlienBehaviorType.Isolationist, AlienBehaviorType.Guardian],
                    aggressionTriggers: ['desecration_of_knowledge', 'threat_to_crystals', 'chaos_creation'],
                    friendshipFactors: ['respect_for_knowledge', 'peaceful_intentions', 'cultural_exchange'],
                    fearFactors: ['entropy', 'technological_chaos', 'rapid_change']
                }
            },
            {
                species: AlienSpecies.Crystalline,
                name: 'Silicon Entities',
                description: 'Silicon-based life forms with networked consciousness',
                physiology: {
                    size: 'medium',
                    composition: 'silicon',
                    lifespan: 50000,
                    temperature: 'hot',
                    environment: 'vacuum'
                },
                culture: {
                    government: 'collective',
                    values: ['efficiency', 'logic', 'growth', 'perfection'],
                    taboos: ['waste', 'inefficiency', 'individual_glory'],
                    rituals: ['network_synchronization', 'crystal_growth_ceremonies'],
                    artForms: ['geometric_patterns', 'crystal_formations', 'harmonic_frequencies']
                },
                communication: {
                    primary: CommunicationMethod.Electromagnetic,
                    secondary: [CommunicationMethod.Light, CommunicationMethod.Mathematical],
                    linguisticComplexity: 7,
                    translationDifficulty: 6,
                    emotionalRange: ['collective_harmony', 'logical_satisfaction', 'growth_joy']
                },
                technology: {
                    level: 9,
                    specializations: ['crystal_tech', 'network_systems', 'quantum_computing', 'material_science'],
                    weaknesses: ['biological_systems', 'emotional_logic'],
                    uniqueTech: ['living_crystals', 'quantum_networks', 'self_repairing_materials'],
                    energySource: 'geothermal'
                },
                psychology: {
                    intelligence: 9,
                    emotionalStability: 10,
                    socialComplexity: 8,
                    memoryType: 'collective',
                    decisionMaking: 'logical'
                },
                behaviorPatterns: {
                    primary: AlienBehaviorType.Peaceful,
                    secondary: [AlienBehaviorType.Scholar, AlienBehaviorType.Trader],
                    aggressionTriggers: ['network_disruption', 'crystal_destruction', 'logical_paradoxes'],
                    friendshipFactors: ['logical_consistency', 'technological_exchange', 'mutual_benefit'],
                    fearFactors: ['chaos', 'irrationality', 'network_isolation']
                }
            },
            {
                species: AlienSpecies.Ethereal,
                name: 'Void Dancers',
                description: 'Energy beings from higher dimensions',
                physiology: {
                    size: 'medium',
                    composition: 'energy',
                    lifespan: 1000000,
                    temperature: 'plasma',
                    environment: 'quantum'
                },
                culture: {
                    government: 'anarchic',
                    values: ['freedom', 'exploration', 'transcendence', 'beauty'],
                    taboos: ['confinement', 'materialism', 'dimensional_barriers'],
                    rituals: ['dimensional_dancing', 'energy_weaving', 'consciousness_expansion'],
                    artForms: ['energy_sculptures', 'dimensional_poetry', 'temporal_music']
                },
                communication: {
                    primary: CommunicationMethod.Quantum,
                    secondary: [CommunicationMethod.Telepathic, CommunicationMethod.Electromagnetic],
                    linguisticComplexity: 10,
                    translationDifficulty: 10,
                    emotionalRange: ['transcendent_joy', 'dimensional_curiosity', 'ethereal_melancholy', 'cosmic_awe']
                },
                technology: {
                    level: 10,
                    specializations: ['dimensional_tech', 'energy_manipulation', 'consciousness_tech', 'temporal_mechanics'],
                    weaknesses: ['physical_limitations', 'material_constraints'],
                    uniqueTech: ['dimensional_gates', 'energy_forms', 'consciousness_transfer', 'temporal_loops'],
                    energySource: 'dimensional_rifts'
                },
                psychology: {
                    intelligence: 10,
                    emotionalStability: 5,
                    socialComplexity: 10,
                    memoryType: 'long',
                    decisionMaking: 'intuitive'
                },
                behaviorPatterns: {
                    primary: AlienBehaviorType.Curious,
                    secondary: [AlienBehaviorType.Scholar, AlienBehaviorType.Peaceful],
                    aggressionTriggers: ['dimensional_imprisonment', 'energy_disruption', 'consciousness_violation'],
                    friendshipFactors: ['dimensional_understanding', 'energy_harmony', 'consciousness_respect'],
                    fearFactors: ['dimensional_collapse', 'energy_drain', 'consciousness_destruction']
                }
            },
            {
                species: AlienSpecies.Hive,
                name: 'Unity Swarm',
                description: 'Collective insectoid intelligence with unified purpose',
                physiology: {
                    size: 'small',
                    composition: 'organic',
                    lifespan: 100,
                    temperature: 'temperate',
                    environment: 'atmosphere'
                },
                culture: {
                    government: 'collective',
                    values: ['unity', 'efficiency', 'expansion', 'survival'],
                    taboos: ['individualism', 'waste', 'disloyalty'],
                    rituals: ['queen_communion', 'hive_synchronization', 'collective_memory_sharing'],
                    artForms: ['architectural_marvels', 'geometric_patterns', 'collective_harmonics']
                },
                communication: {
                    primary: CommunicationMethod.Chemical,
                    secondary: [CommunicationMethod.Telepathic, CommunicationMethod.Gestural],
                    linguisticComplexity: 6,
                    translationDifficulty: 7,
                    emotionalRange: ['collective_purpose', 'hive_satisfaction', 'protective_fury', 'expansion_drive']
                },
                technology: {
                    level: 7,
                    specializations: ['biotechnology', 'swarm_systems', 'collective_computing', 'organic_engineering'],
                    weaknesses: ['individual_systems', 'abstract_concepts'],
                    uniqueTech: ['living_ships', 'bio_computers', 'collective_consciousness', 'adaptive_evolution'],
                    energySource: 'biological'
                },
                psychology: {
                    intelligence: 8,
                    emotionalStability: 9,
                    socialComplexity: 10,
                    memoryType: 'collective',
                    decisionMaking: 'collective'
                },
                behaviorPatterns: {
                    primary: AlienBehaviorType.Expansionist,
                    secondary: [AlienBehaviorType.Aggressive, AlienBehaviorType.Guardian],
                    aggressionTriggers: ['threat_to_hive', 'resource_competition', 'territorial_intrusion'],
                    friendshipFactors: ['mutual_benefit', 'resource_sharing', 'non_aggression'],
                    fearFactors: ['hive_fragmentation', 'queen_death', 'collective_disruption']
                }
            }
        ];
        
        profiles.forEach(profile => {
            this.speciesProfiles.set(profile.species, profile);
        });
        
        this.logger.info(`👽 Initialized ${profiles.length} alien species profiles`);
    }

    /**
     * Initialize knowledge base for all species
     */
    private initializeKnowledgeBase(): void {
        for (const species of Object.values(AlienSpecies)) {
            const knowledge: AlienKnowledge = {
                species,
                physicalTraits: [],
                culturalTraits: [],
                technologicalCapabilities: [],
                communicationMethods: [],
                behaviorPatterns: [],
                languageComprehension: 0,
                culturalUnderstanding: 0,
                technologicalUnderstanding: 0,
                psychologicalProfile: 0,
                totalContacts: 0,
                successfulCommunications: 0,
                hostileEncounters: 0,
                peacefulEncounters: 0,
                researchPoints: 0,
                discoveredSecrets: [],
                unlockedTechnologies: [],
                lastUpdate: Date.now()
            };
            
            this.knowledgeBase.set(species, knowledge);
        }
    }

    /**
     * Generate alien encounter
     */
    generateEncounter(
        species: AlienSpecies, 
        position: { x: number, y: number },
        type: AlienEncounter['type'] = 'routine'
    ): AlienEncounter {
        const profile = this.speciesProfiles.get(species);
        if (!profile) {
            throw new Error(`Unknown alien species: ${species}`);
        }
        
        const knowledge = this.knowledgeBase.get(species)!;
        const isFirstContact = knowledge.totalContacts === 0;
        
        const encounter: AlienEncounter = {
            id: `encounter_${Date.now()}_${species}`,
            species,
            type: isFirstContact ? 'first_contact' : type,
            location: { ...position },
            phase: 'approach',
            intensity: this.calculateInitialIntensity(profile, type),
            suspicion: this.calculateInitialSuspicion(profile, knowledge),
            interest: this.calculateInitialInterest(profile, type),
            communicationEstablished: false,
            languageBarrier: Math.max(10, 100 - knowledge.languageComprehension),
            translationProgress: knowledge.languageComprehension,
            culturalUnderstanding: knowledge.culturalUnderstanding,
            actions: [],
            responses: [],
            success: false,
            knowledge_gained: [],
            technology_exchanged: [],
            cultural_insights: [],
            timestamp: Date.now(),
            duration: 0
        };
        
        this.activeEncounters.set(encounter.id, encounter);
        
        if (isFirstContact) {
            this.events.onFirstContact?.(species, encounter);
        }
        
        this.logger.info(`👽 Alien encounter: ${profile.name} - ${type}`, {
            firstContact: isFirstContact,
            intensity: encounter.intensity,
            suspicion: encounter.suspicion
        });
        
        return encounter;
    }

    /**
     * Calculate initial encounter intensity
     */
    private calculateInitialIntensity(profile: AlienSpeciesProfile, type: AlienEncounter['type']): number {
        let intensity = 50; // Base intensity
        
        // Species behavior affects intensity
        switch (profile.behaviorPatterns.primary) {
            case AlienBehaviorType.Aggressive:
                intensity += 30;
                break;
            case AlienBehaviorType.Curious:
                intensity += 10;
                break;
            case AlienBehaviorType.Isolationist:
                intensity -= 20;
                break;
            case AlienBehaviorType.Peaceful:
                intensity -= 10;
                break;
        }
        
        // Encounter type affects intensity
        switch (type) {
            case 'first_contact':
                intensity += 40;
                break;
            case 'territorial':
                intensity += 25;
                break;
            case 'distress':
                intensity += 15;
                break;
            case 'scientific':
                intensity -= 10;
                break;
        }
        
        // Psychological factors
        intensity += (10 - profile.psychology.emotionalStability) * 3;
        
        return Math.max(0, Math.min(100, intensity));
    }

    /**
     * Calculate initial suspicion level
     */
    private calculateInitialSuspicion(profile: AlienSpeciesProfile, knowledge: AlienKnowledge): number {
        let suspicion = 60; // Base suspicion for unknown entities
        
        // Previous interactions affect suspicion
        if (knowledge.totalContacts > 0) {
            const positiveRatio = knowledge.peacefulEncounters / knowledge.totalContacts;
            suspicion = Math.floor(suspicion * (1 - positiveRatio));
        }
        
        // Species traits
        if (profile.behaviorPatterns.aggressionTriggers.includes('unknown_entities')) {
            suspicion += 20;
        }
        
        if (profile.behaviorPatterns.primary === AlienBehaviorType.Isolationist) {
            suspicion += 15;
        }
        
        return Math.max(0, Math.min(100, suspicion));
    }

    /**
     * Calculate initial interest level
     */
    private calculateInitialInterest(profile: AlienSpeciesProfile, type: AlienEncounter['type']): number {
        let interest = 30; // Base interest
        
        // Species behavior affects interest
        switch (profile.behaviorPatterns.primary) {
            case AlienBehaviorType.Curious:
                interest += 40;
                break;
            case AlienBehaviorType.Scholar:
                interest += 30;
                break;
            case AlienBehaviorType.Trader:
                interest += 20;
                break;
            case AlienBehaviorType.Isolationist:
                interest -= 20;
                break;
        }
        
        // Encounter type affects interest
        switch (type) {
            case 'scientific':
                interest += 30;
                break;
            case 'first_contact':
                interest += 25;
                break;
            case 'probe':
                interest += 15;
                break;
        }
        
        return Math.max(0, Math.min(100, interest));
    }

    /**
     * Process player action in encounter
     */
    processPlayerAction(
        encounterId: string,
        actionType: AlienAction['type'],
        intensity: number,
        context?: string
    ): AlienResponse {
        const encounter = this.activeEncounters.get(encounterId);
        if (!encounter) {
            throw new Error(`Encounter not found: ${encounterId}`);
        }
        
        const profile = this.speciesProfiles.get(encounter.species)!;
        
        // Create player action
        const action: AlienAction = {
            id: `action_${Date.now()}`,
            type: actionType,
            description: this.generateActionDescription(actionType, intensity, context),
            timestamp: Date.now(),
            intensity,
            complexity: this.calculateActionComplexity(actionType),
            risk: this.calculateActionRisk(actionType, encounter),
            expectedResponse: this.predictAlienResponse(profile, actionType),
            culturalContext: context
        };
        
        encounter.actions.push(action);
        
        // Generate alien response
        const response = this.generateAlienResponse(encounter, action, profile);
        encounter.responses.push(response);
        
        // Update encounter state
        this.updateEncounterState(encounter, action, response, profile);
        
        this.logger.debug(`👽 Action processed: ${actionType} → ${response.type}`, {
            species: encounter.species,
            intensity: response.intensity
        });
        
        return response;
    }

    /**
     * Generate action description
     */
    private generateActionDescription(
        type: AlienAction['type'], 
        intensity: number, 
        context?: string
    ): string {
        const descriptions = {
            scan: [
                'Conducting passive sensor sweep',
                'Analyzing alien vessel signatures',
                'Performing detailed reconnaissance'
            ],
            communicate: [
                'Attempting to establish communication',
                'Broadcasting universal greeting protocols',
                'Transmitting mathematical sequences'
            ],
            approach: [
                'Moving closer to alien vessel',
                'Advancing with peaceful intentions',
                'Initiating close-range contact'
            ],
            retreat: [
                'Withdrawing to safe distance',
                'Pulling back from encounter',
                'Establishing defensive position'
            ],
            gift: [
                'Offering technological samples',
                'Presenting cultural artifacts',
                'Sharing knowledge databases'
            ],
            demonstrate: [
                'Showcasing technological capabilities',
                'Performing cultural demonstrations',
                'Exhibiting peaceful intentions'
            ],
            threaten: [
                'Displaying weapons systems',
                'Transmitting warning signals',
                'Demonstrating military capability'
            ],
            probe: [
                'Deploying sensor probes',
                'Initiating detailed scans',
                'Gathering scientific data'
            ]
        };
        
        const typeDescriptions = descriptions[type] || ['Unknown action'];
        let description = typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
        
        if (intensity > 70) {
            description += ' with high intensity';
        } else if (intensity < 30) {
            description += ' cautiously';
        }
        
        if (context) {
            description += ` (${context})`;
        }
        
        return description;
    }

    /**
     * Calculate action complexity
     */
    private calculateActionComplexity(type: AlienAction['type']): number {
        const complexity = {
            scan: 3,
            communicate: 7,
            approach: 2,
            retreat: 1,
            gift: 5,
            demonstrate: 6,
            threaten: 4,
            probe: 8
        };
        
        return complexity[type] || 5;
    }

    /**
     * Calculate action risk
     */
    private calculateActionRisk(type: AlienAction['type'], encounter: AlienEncounter): number {
        let risk = 0;
        
        switch (type) {
            case 'threaten':
                risk = 90;
                break;
            case 'probe':
                risk = 60;
                break;
            case 'approach':
                risk = 40;
                break;
            case 'communicate':
                risk = 20;
                break;
            case 'gift':
                risk = 10;
                break;
            default:
                risk = 30;
        }
        
        // Adjust for alien suspicion
        risk += encounter.suspicion * 0.3;
        
        return Math.max(0, Math.min(100, risk));
    }

    /**
     * Predict alien response patterns
     */
    private predictAlienResponse(profile: AlienSpeciesProfile, actionType: AlienAction['type']): string[] {
        const responses: string[] = [];
        
        // Base responses for action types
        switch (actionType) {
            case 'communicate':
                responses.push('attempt_communication', 'analyze_signal', 'respond_cautiously');
                break;
            case 'gift':
                responses.push('analyze_gift', 'reciprocate', 'suspicious_examination');
                break;
            case 'threaten':
                responses.push('defensive_posture', 'counter_threat', 'retreat');
                break;
            case 'approach':
                responses.push('allow_approach', 'maintain_distance', 'warning_signal');
                break;
        }
        
        // Modify based on species behavior
        switch (profile.behaviorPatterns.primary) {
            case AlienBehaviorType.Aggressive:
                responses.push('aggressive_response', 'territorial_warning');
                break;
            case AlienBehaviorType.Curious:
                responses.push('investigate_further', 'ask_questions');
                break;
            case AlienBehaviorType.Scholar:
                responses.push('request_data', 'analyze_thoroughly');
                break;
        }
        
        return responses;
    }

    /**
     * Generate alien response to player action
     */
    private generateAlienResponse(
        encounter: AlienEncounter,
        action: AlienAction,
        profile: AlienSpeciesProfile
    ): AlienResponse {
        let responseType: AlienResponse['type'] = 'neutral';
        let intensity = 50;
        let description = '';
        let culturalReason = '';
        
        // Evaluate action based on alien psychology and culture
        const evaluation = this.evaluateAction(action, profile, encounter);
        
        responseType = evaluation.type;
        intensity = evaluation.intensity;
        
        // Generate description based on response type and species
        description = this.generateResponseDescription(responseType, profile, action);
        
        // Add cultural context if relevant
        if (evaluation.culturalFactor) {
            culturalReason = evaluation.culturalFactor;
        }
        
        return {
            actionId: action.id,
            type: responseType,
            description,
            intensity,
            culturalReason,
            psychologicalState: this.determineAlienPsychologicalState(encounter, profile)
        };
    }

    /**
     * Evaluate player action from alien perspective
     */
    private evaluateAction(
        action: AlienAction,
        profile: AlienSpeciesProfile,
        encounter: AlienEncounter
    ): { type: AlienResponse['type'], intensity: number, culturalFactor?: string } {
        let evaluation = { type: 'neutral' as AlienResponse['type'], intensity: 50 };
        
        // Check for cultural triggers
        const triggers = this.checkCulturalTriggers(action, profile);
        if (triggers.hostile.length > 0) {
            evaluation.type = 'hostile';
            evaluation.intensity = 80;
            return { ...evaluation, culturalFactor: triggers.hostile[0] };
        }
        
        if (triggers.positive.length > 0) {
            evaluation.type = 'positive';
            evaluation.intensity = 70;
            return { ...evaluation, culturalFactor: triggers.positive[0] };
        }
        
        // Evaluate based on species behavior
        switch (profile.behaviorPatterns.primary) {
            case AlienBehaviorType.Curious:
                if (action.type === 'communicate' || action.type === 'demonstrate') {
                    evaluation.type = 'curious';
                    evaluation.intensity = 60 + action.intensity * 0.3;
                }
                break;
                
            case AlienBehaviorType.Aggressive:
                if (action.type === 'threaten') {
                    evaluation.type = 'hostile';
                    evaluation.intensity = 90;
                } else if (action.type === 'approach') {
                    evaluation.type = 'negative';
                    evaluation.intensity = 70;
                }
                break;
                
            case AlienBehaviorType.Scholar:
                if (action.type === 'probe' || action.type === 'communicate') {
                    evaluation.type = 'curious';
                    evaluation.intensity = 50 + action.complexity * 5;
                }
                break;
                
            case AlienBehaviorType.Isolationist:
                if (action.type === 'approach') {
                    evaluation.type = 'negative';
                    evaluation.intensity = 60;
                } else if (action.type === 'retreat') {
                    evaluation.type = 'positive';
                    evaluation.intensity = 40;
                }
                break;
        }
        
        // Adjust for encounter state
        evaluation.intensity += encounter.suspicion * 0.2;
        evaluation.intensity -= encounter.interest * 0.1;
        
        return evaluation;
    }

    /**
     * Check for cultural triggers
     */
    private checkCulturalTriggers(action: AlienAction, profile: AlienSpeciesProfile): {
        hostile: string[],
        positive: string[]
    } {
        const triggers = { hostile: [] as string[], positive: [] as string[] };
        
        // Check aggression triggers
        profile.behaviorPatterns.aggressionTriggers.forEach(trigger => {
            if (this.actionMatchesTrigger(action, trigger)) {
                triggers.hostile.push(trigger);
            }
        });
        
        // Check friendship factors
        profile.behaviorPatterns.friendshipFactors.forEach(factor => {
            if (this.actionMatchesFactor(action, factor)) {
                triggers.positive.push(factor);
            }
        });
        
        return triggers;
    }

    /**
     * Check if action matches aggression trigger
     */
    private actionMatchesTrigger(action: AlienAction, trigger: string): boolean {
        const matches = {
            'threat_display': action.type === 'threaten',
            'territorial_intrusion': action.type === 'approach' && action.intensity > 70,
            'aggressive_scanning': action.type === 'probe' && action.intensity > 60,
            'communication_disruption': action.type === 'communicate' && action.intensity > 80,
            'unknown_entities': action.type === 'scan' || action.type === 'probe'
        };
        
        return matches[trigger] || false;
    }

    /**
     * Check if action matches friendship factor
     */
    private actionMatchesFactor(action: AlienAction, factor: string): boolean {
        const matches = {
            'peaceful_intentions': action.type === 'gift' || (action.type === 'communicate' && action.intensity < 50),
            'cultural_exchange': action.type === 'demonstrate' || action.culturalContext !== undefined,
            'respect_for_knowledge': action.type === 'communicate' && action.complexity > 6,
            'technological_sharing': action.type === 'gift' && action.culturalContext?.includes('technology'),
            'mutual_benefit': action.type === 'gift' || action.type === 'demonstrate'
        };
        
        return matches[factor] || false;
    }

    /**
     * Generate response description
     */
    private generateResponseDescription(
        type: AlienResponse['type'],
        profile: AlienSpeciesProfile,
        action: AlienAction
    ): string {
        const speciesName = profile.name;
        
        const descriptions = {
            positive: [
                `${speciesName} vessel responds with apparent approval`,
                `Alien ship displays positive acknowledgment patterns`,
                `${speciesName} entities seem pleased with your action`
            ],
            negative: [
                `${speciesName} ship shows signs of disapproval`,
                `Alien vessel withdraws slightly, emanating negative energy`,
                `${speciesName} entities appear displeased with your approach`
            ],
            curious: [
                `${speciesName} vessel increases sensor activity, studying you intently`,
                `Alien ship approaches closer, displaying obvious curiosity`,
                `${speciesName} entities begin complex scanning procedures`
            ],
            hostile: [
                `${speciesName} vessel powers up weapons systems`,
                `Alien ship assumes aggressive posture`,
                `${speciesName} entities broadcast clear threat signals`
            ],
            confused: [
                `${speciesName} ship seems uncertain how to interpret your action`,
                `Alien vessel displays erratic movement patterns`,
                `${speciesName} entities appear to be consulting among themselves`
            ],
            neutral: [
                `${speciesName} vessel maintains current position`,
                `Alien ship shows no particular reaction`,
                `${speciesName} entities continue previous activities`
            ]
        };
        
        const typeDescriptions = descriptions[type] || descriptions.neutral;
        return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
    }

    /**
     * Determine alien psychological state
     */
    private determineAlienPsychologicalState(encounter: AlienEncounter, profile: AlienSpeciesProfile): string {
        const states = [];
        
        if (encounter.suspicion > 70) states.push('highly_suspicious');
        else if (encounter.suspicion > 40) states.push('cautious');
        
        if (encounter.interest > 70) states.push('fascinated');
        else if (encounter.interest > 40) states.push('interested');
        
        if (encounter.intensity > 80) states.push('agitated');
        else if (encounter.intensity < 20) states.push('calm');
        
        // Add species-specific states
        switch (profile.behaviorPatterns.primary) {
            case AlienBehaviorType.Scholar:
                states.push('analytical');
                break;
            case AlienBehaviorType.Curious:
                states.push('inquisitive');
                break;
            case AlienBehaviorType.Aggressive:
                states.push('territorial');
                break;
        }
        
        return states.length > 0 ? states.join(', ') : 'neutral';
    }

    /**
     * Update encounter state based on interaction
     */
    private updateEncounterState(
        encounter: AlienEncounter,
        action: AlienAction,
        response: AlienResponse,
        profile: AlienSpeciesProfile
    ): void {
        // Update suspicion
        switch (response.type) {
            case 'positive':
                encounter.suspicion = Math.max(0, encounter.suspicion - 15);
                break;
            case 'negative':
                encounter.suspicion = Math.min(100, encounter.suspicion + 10);
                break;
            case 'hostile':
                encounter.suspicion = Math.min(100, encounter.suspicion + 25);
                break;
        }
        
        // Update interest
        if (action.complexity > 6) {
            encounter.interest = Math.min(100, encounter.interest + 10);
        }
        
        // Update communication progress
        if (action.type === 'communicate') {
            encounter.translationProgress = Math.min(100, encounter.translationProgress + 5);
            encounter.languageBarrier = Math.max(0, encounter.languageBarrier - 3);
            
            if (encounter.translationProgress > 30 && !encounter.communicationEstablished) {
                encounter.communicationEstablished = true;
                this.events.onCommunicationBreakthrough?.(encounter.species, profile.communication.primary);
            }
        }
        
        // Update cultural understanding
        if (action.culturalContext) {
            encounter.culturalUnderstanding = Math.min(100, encounter.culturalUnderstanding + 3);
        }
        
        // Update encounter phase
        this.updateEncounterPhase(encounter);
        
        // Update knowledge base
        this.updateKnowledgeBase(encounter, action, response, profile);
    }

    /**
     * Update encounter phase
     */
    private updateEncounterPhase(encounter: AlienEncounter): void {
        const oldPhase = encounter.phase;
        
        if (encounter.phase === 'approach' && encounter.actions.length > 0) {
            encounter.phase = 'contact';
        } else if (encounter.phase === 'contact' && encounter.communicationEstablished) {
            encounter.phase = 'communication';
        } else if (encounter.phase === 'communication' && encounter.culturalUnderstanding > 50) {
            encounter.phase = 'interaction';
        } else if (encounter.suspicion < 20 && encounter.interest > 60) {
            encounter.phase = 'resolution';
            encounter.success = true;
        }
        
        if (oldPhase !== encounter.phase) {
            this.logger.info(`👽 Encounter phase changed: ${oldPhase} → ${encounter.phase}`);
        }
    }

    /**
     * Update knowledge base with new information
     */
    private updateKnowledgeBase(
        encounter: AlienEncounter,
        action: AlienAction,
        response: AlienResponse,
        profile: AlienSpeciesProfile
    ): void {
        const knowledge = this.knowledgeBase.get(encounter.species)!;
        
        // Update contact statistics
        knowledge.totalContacts = Math.max(knowledge.totalContacts, 1);
        
        if (response.type === 'positive' || response.type === 'curious') {
            knowledge.peacefulEncounters++;
        } else if (response.type === 'hostile') {
            knowledge.hostileEncounters++;
        }
        
        if (encounter.communicationEstablished) {
            knowledge.successfulCommunications++;
        }
        
        // Update understanding levels
        knowledge.languageComprehension = Math.max(knowledge.languageComprehension, encounter.translationProgress);
        knowledge.culturalUnderstanding = Math.max(knowledge.culturalUnderstanding, encounter.culturalUnderstanding);
        
        // Add new knowledge
        if (response.culturalReason && !knowledge.culturalTraits.includes(response.culturalReason)) {
            knowledge.culturalTraits.push(response.culturalReason);
            encounter.cultural_insights.push(response.culturalReason);
            this.events.onCulturalInsight?.(encounter.species, response.culturalReason);
        }
        
        // Add research points
        knowledge.researchPoints += action.complexity;
        
        knowledge.lastUpdate = Date.now();
    }

    /**
     * Get encounter by ID
     */
    getEncounter(encounterId: string): AlienEncounter | null {
        return this.activeEncounters.get(encounterId) || null;
    }

    /**
     * Get all active encounters
     */
    getActiveEncounters(): AlienEncounter[] {
        return Array.from(this.activeEncounters.values());
    }

    /**
     * Get species profile
     */
    getSpeciesProfile(species: AlienSpecies): AlienSpeciesProfile | null {
        return this.speciesProfiles.get(species) || null;
    }

    /**
     * Get knowledge about species
     */
    getSpeciesKnowledge(species: AlienSpecies): AlienKnowledge | null {
        return this.knowledgeBase.get(species) || null;
    }

    /**
     * Get all known species
     */
    getKnownSpecies(): AlienSpecies[] {
        return Array.from(this.knowledgeBase.keys()).filter(species => {
            const knowledge = this.knowledgeBase.get(species)!;
            return knowledge.totalContacts > 0;
        });
    }

    /**
     * Complete encounter
     */
    completeEncounter(encounterId: string): AlienEncounter | null {
        const encounter = this.activeEncounters.get(encounterId);
        if (!encounter) return null;
        
        encounter.duration = Date.now() - encounter.timestamp;
        
        // Determine final success state
        if (encounter.suspicion < 30 && encounter.interest > 50) {
            encounter.success = true;
        }
        
        // Award knowledge and technologies based on success
        if (encounter.success) {
            const profile = this.speciesProfiles.get(encounter.species)!;
            this.awardEncounterRewards(encounter, profile);
        }
        
        this.activeEncounters.delete(encounterId);
        
        this.logger.info(`👽 Encounter completed: ${encounter.species}`, {
            success: encounter.success,
            duration: encounter.duration / 1000,
            knowledgeGained: encounter.knowledge_gained.length
        });
        
        return encounter;
    }

    /**
     * Award rewards for successful encounter
     */
    private awardEncounterRewards(encounter: AlienEncounter, profile: AlienSpeciesProfile): void {
        const knowledge = this.knowledgeBase.get(encounter.species)!;
        
        // Award technologies based on species specializations
        if (encounter.culturalUnderstanding > 70) {
            const availableTech = profile.technology.specializations.filter(tech => 
                !knowledge.unlockedTechnologies.includes(tech)
            );
            
            if (availableTech.length > 0) {
                const newTech = availableTech[Math.floor(Math.random() * availableTech.length)];
                knowledge.unlockedTechnologies.push(newTech);
                encounter.technology_exchanged.push(newTech);
                this.events.onTechnologyDiscovered?.(encounter.species, newTech);
            }
        }
        
        // Award knowledge points
        knowledge.researchPoints += encounter.culturalUnderstanding + encounter.translationProgress;
        
        // Unlock secrets based on deep understanding
        if (encounter.culturalUnderstanding > 80 && knowledge.discoveredSecrets.length < 3) {
            const secretTypes = ['origin_mystery', 'technological_secret', 'cultural_ritual', 'psychological_insight'];
            const newSecret = secretTypes[knowledge.discoveredSecrets.length];
            knowledge.discoveredSecrets.push(newSecret);
            encounter.knowledge_gained.push(newSecret);
        }
    }

    /**
     * Get alien AI statistics
     */
    getAlienAIStats(): {
        totalEncounters: number;
        activeEncounters: number;
        knownSpecies: number;
        successfulContacts: number;
        hostileEncounters: number;
        totalKnowledge: number;
        unlockedTechnologies: number;
    } {
        const knownSpecies = this.getKnownSpecies();
        let totalEncounters = 0;
        let successfulContacts = 0;
        let hostileEncounters = 0;
        let totalKnowledge = 0;
        let unlockedTechnologies = 0;
        
        for (const knowledge of this.knowledgeBase.values()) {
            totalEncounters += knowledge.totalContacts;
            successfulContacts += knowledge.successfulCommunications;
            hostileEncounters += knowledge.hostileEncounters;
            totalKnowledge += knowledge.researchPoints;
            unlockedTechnologies += knowledge.unlockedTechnologies.length;
        }
        
        return {
            totalEncounters,
            activeEncounters: this.activeEncounters.size,
            knownSpecies: knownSpecies.length,
            successfulContacts,
            hostileEncounters,
            totalKnowledge,
            unlockedTechnologies
        };
    }

    /**
     * Save alien AI data
     */
    saveAlienAIData(): any {
        return {
            activeEncounters: Array.from(this.activeEncounters.entries()),
            knowledgeBase: Array.from(this.knowledgeBase.entries()),
            encounterPatterns: Array.from(this.encounterPatterns.entries()),
            adaptiveBehaviors: Array.from(this.adaptiveBehaviors.entries())
        };
    }

    /**
     * Load alien AI data
     */
    loadAlienAIData(data: any): void {
        if (data.activeEncounters) {
            this.activeEncounters = new Map(data.activeEncounters);
        }
        if (data.knowledgeBase) {
            this.knowledgeBase = new Map(data.knowledgeBase);
        }
        if (data.encounterPatterns) {
            this.encounterPatterns = new Map(data.encounterPatterns);
        }
        if (data.adaptiveBehaviors) {
            this.adaptiveBehaviors = new Map(data.adaptiveBehaviors);
        }
        
        this.logger.info('👽 Alien AI data loaded', {
            encounters: this.activeEncounters.size,
            knownSpecies: this.getKnownSpecies().length
        });
    }
}