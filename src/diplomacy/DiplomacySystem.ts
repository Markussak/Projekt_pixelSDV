/**
 * Diplomacy System
 * Advanced diplomatic interactions with factions, reputation, and negotiations
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';
import { CrewMember } from '@rpg/CrewManagement';

export enum FactionType {
    Government = 'government',
    Corporate = 'corporate',
    Military = 'military',
    Pirates = 'pirates',
    Traders = 'traders',
    Scientists = 'scientists',
    Aliens = 'aliens',
    Rebels = 'rebels',
    Religious = 'religious',
    Independent = 'independent'
}

export enum DiplomaticStance {
    Allied = 'allied',           // +80 to +100
    Friendly = 'friendly',       // +40 to +79
    Neutral = 'neutral',         // -39 to +39
    Unfriendly = 'unfriendly',   // -79 to -40
    Hostile = 'hostile',         // -100 to -80
    War = 'war'                  // Active warfare
}

export enum NegotiationType {
    Trade = 'trade',
    Information = 'information',
    SafePassage = 'safe_passage',
    Alliance = 'alliance',
    Ceasefire = 'ceasefire',
    Technology = 'technology',
    Territory = 'territory',
    Tribute = 'tribute'
}

export interface Faction {
    id: string;
    name: string;
    type: FactionType;
    description: string;
    
    // Political attributes
    government: 'democracy' | 'autocracy' | 'oligarchy' | 'theocracy' | 'anarchy';
    ideology: 'expansionist' | 'isolationist' | 'pacifist' | 'militaristic' | 'commercial';
    
    // Reputation and relationships
    reputation: number; // -100 to +100
    stance: DiplomaticStance;
    trustLevel: number; // 0-100, affects negotiation success
    
    // Faction characteristics
    power: number; // 1-100, military/economic strength
    territory: string[]; // Controlled systems
    resources: FactionResources;
    
    // Diplomatic history
    treaties: Treaty[];
    recentActions: DiplomaticAction[];
    
    // AI personality
    personality: FactionPersonality;
    
    // Status
    isActive: boolean;
    lastContact: number;
    homeSystem: string;
}

export interface FactionResources {
    military: number;
    economic: number;
    technological: number;
    influence: number;
}

export interface FactionPersonality {
    aggression: number; // 0-100
    cooperation: number; // 0-100
    trustworthiness: number; // 0-100
    pride: number; // 0-100
    greed: number; // 0-100
    xenophobia: number; // 0-100 (for aliens)
}

export interface Treaty {
    id: string;
    type: 'trade' | 'non_aggression' | 'alliance' | 'technology_sharing' | 'territory';
    participants: string[]; // Faction IDs
    terms: TreatyTerm[];
    startDate: number;
    duration: number; // -1 for permanent
    status: 'active' | 'violated' | 'expired' | 'suspended';
}

export interface TreatyTerm {
    type: 'trade_bonus' | 'military_support' | 'information_sharing' | 'territory_access' | 'tribute';
    beneficiary: string; // Faction ID
    value: number;
    description: string;
}

export interface DiplomaticAction {
    id: string;
    type: 'contact' | 'trade' | 'threat' | 'gift' | 'treaty_offer' | 'treaty_violation' | 'war_declaration';
    actor: string; // Faction ID
    target: string; // Faction ID
    timestamp: number;
    description: string;
    reputationChange: number;
    successful: boolean;
}

export interface NegotiationSession {
    id: string;
    participants: string[]; // Faction IDs
    type: NegotiationType;
    currentOffer: NegotiationOffer;
    counterOffer?: NegotiationOffer;
    
    // Negotiation state
    rounds: number;
    maxRounds: number;
    status: 'active' | 'successful' | 'failed' | 'abandoned';
    
    // Modifiers
    playerSkill: number; // Communications/Charisma bonuses
    crewBonus: number; // Diplomatic crew bonuses
    reputationModifier: number;
}

export interface NegotiationOffer {
    proposer: string; // Faction ID
    terms: OfferTerm[];
    totalValue: number; // AI-calculated offer value
    priority: number; // How much proposer wants this
}

export interface OfferTerm {
    type: 'credits' | 'items' | 'information' | 'territory' | 'technology' | 'service' | 'protection';
    giver: string; // Faction ID
    receiver: string; // Faction ID
    description: string;
    value: number; // AI-calculated worth
    items?: { itemId: string, quantity: number }[];
}

export interface DiplomaticEncounter {
    id: string;
    factionId: string;
    type: 'first_contact' | 'routine_patrol' | 'distress_call' | 'territorial_dispute' | 'trade_opportunity';
    location: { x: number, y: number };
    
    // Encounter details
    description: string;
    availableActions: EncounterAction[];
    consequences: EncounterConsequence[];
    
    // Status
    isActive: boolean;
    resolution?: 'peaceful' | 'hostile' | 'neutral' | 'beneficial';
    timestamp: number;
}

export interface EncounterAction {
    id: string;
    name: string;
    description: string;
    requirements?: ActionRequirement[];
    skillCheck?: { skill: string, difficulty: number };
    consequences: EncounterConsequence[];
}

export interface ActionRequirement {
    type: 'reputation' | 'crew_skill' | 'technology' | 'item' | 'treaty';
    value: number | string;
    description: string;
}

export interface EncounterConsequence {
    type: 'reputation' | 'resources' | 'information' | 'combat' | 'treaty_offer' | 'trade_opportunity';
    factionId: string;
    value: number;
    description: string;
    items?: { itemId: string, quantity: number }[];
}

export interface DiplomacyEvents {
    onFirstContact?: (faction: Faction) => void;
    onReputationChanged?: (factionId: string, oldRep: number, newRep: number) => void;
    onTreatyProposed?: (treaty: Treaty) => void;
    onTreatyRatified?: (treaty: Treaty) => void;
    onWarDeclared?: (aggressor: string, target: string) => void;
    onNegotiationStarted?: (session: NegotiationSession) => void;
    onNegotiationCompleted?: (session: NegotiationSession, success: boolean) => void;
    onEncounterGenerated?: (encounter: DiplomaticEncounter) => void;
}

export class DiplomacySystem {
    private factions: Map<string, Faction> = new Map();
    private treaties: Map<string, Treaty> = new Map();
    private negotiations: Map<string, NegotiationSession> = new Map();
    private encounters: Map<string, DiplomaticEncounter> = new Map();
    private diplomaticActions: DiplomaticAction[] = [];
    
    // Player faction
    private readonly PLAYER_FACTION_ID = 'player';
    
    private events: DiplomacyEvents;
    private logger: Logger;

    constructor(events: DiplomacyEvents = {}) {
        this.logger = new Logger('DiplomacySystem');
        this.events = events;
        
        this.initializeFactions();
        this.initializePlayerFaction();
        
        this.logger.info('🤝 Diplomacy system initialized');
    }

    /**
     * Initialize major factions
     */
    private initializeFactions(): void {
        const factions: Faction[] = [
            {
                id: 'terran_federation',
                name: 'Terran Federation',
                type: FactionType.Government,
                description: 'Democratic alliance of human colonies',
                government: 'democracy',
                ideology: 'expansionist',
                reputation: 25,
                stance: DiplomaticStance.Friendly,
                trustLevel: 70,
                power: 85,
                territory: ['sol_system', 'alpha_centauri', 'proxima_station'],
                resources: {
                    military: 80,
                    economic: 90,
                    technological: 85,
                    influence: 75
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 30,
                    cooperation: 80,
                    trustworthiness: 85,
                    pride: 60,
                    greed: 40,
                    xenophobia: 20
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'sol_system'
            },
            {
                id: 'zephyrian_empire',
                name: 'Zephyrian Empire',
                type: FactionType.Aliens,
                description: 'Ancient alien empire with advanced technology',
                government: 'autocracy',
                ideology: 'isolationist',
                reputation: -10,
                stance: DiplomaticStance.Neutral,
                trustLevel: 45,
                power: 95,
                territory: ['zephyr_prime', 'nebula_omega', 'crystal_worlds'],
                resources: {
                    military: 90,
                    economic: 70,
                    technological: 100,
                    influence: 60
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 50,
                    cooperation: 30,
                    trustworthiness: 60,
                    pride: 90,
                    greed: 20,
                    xenophobia: 70
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'zephyr_prime'
            },
            {
                id: 'crimson_cartel',
                name: 'Crimson Cartel',
                type: FactionType.Pirates,
                description: 'Notorious pirate confederation',
                government: 'anarchy',
                ideology: 'militaristic',
                reputation: -60,
                stance: DiplomaticStance.Hostile,
                trustLevel: 15,
                power: 45,
                territory: ['asteroid_belt_7', 'rogue_station'],
                resources: {
                    military: 70,
                    economic: 40,
                    technological: 30,
                    influence: 25
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 85,
                    cooperation: 20,
                    trustworthiness: 25,
                    pride: 70,
                    greed: 90,
                    xenophobia: 40
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'asteroid_belt_7'
            },
            {
                id: 'hegemony_corp',
                name: 'Hegemony Corporation',
                type: FactionType.Corporate,
                description: 'Mega-corporation controlling trade routes',
                government: 'oligarchy',
                ideology: 'commercial',
                reputation: 15,
                stance: DiplomaticStance.Neutral,
                trustLevel: 55,
                power: 75,
                territory: ['trade_hub_alpha', 'mining_sector_12'],
                resources: {
                    military: 50,
                    economic: 100,
                    technological: 70,
                    influence: 80
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 40,
                    cooperation: 60,
                    trustworthiness: 50,
                    pride: 50,
                    greed: 85,
                    xenophobia: 30
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'trade_hub_alpha'
            },
            {
                id: 'void_seekers',
                name: 'Void Seekers',
                type: FactionType.Religious,
                description: 'Mystical order seeking ancient knowledge',
                government: 'theocracy',
                ideology: 'pacifist',
                reputation: 5,
                stance: DiplomaticStance.Neutral,
                trustLevel: 75,
                power: 30,
                territory: ['sanctuary_worlds'],
                resources: {
                    military: 20,
                    economic: 40,
                    technological: 60,
                    influence: 70
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 10,
                    cooperation: 70,
                    trustworthiness: 90,
                    pride: 40,
                    greed: 10,
                    xenophobia: 5
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'sanctuary_worlds'
            },
            {
                id: 'liberation_front',
                name: 'Liberation Front',
                type: FactionType.Rebels,
                description: 'Revolutionary movement fighting oppression',
                government: 'democracy',
                ideology: 'militaristic',
                reputation: -20,
                stance: DiplomaticStance.Unfriendly,
                trustLevel: 40,
                power: 35,
                territory: ['frontier_colonies'],
                resources: {
                    military: 60,
                    economic: 30,
                    technological: 40,
                    influence: 50
                },
                treaties: [],
                recentActions: [],
                personality: {
                    aggression: 70,
                    cooperation: 50,
                    trustworthiness: 60,
                    pride: 80,
                    greed: 30,
                    xenophobia: 35
                },
                isActive: true,
                lastContact: 0,
                homeSystem: 'frontier_colonies'
            }
        ];
        
        factions.forEach(faction => {
            this.factions.set(faction.id, faction);
        });
        
        this.logger.info(`🏛️ Initialized ${factions.length} major factions`);
    }

    /**
     * Initialize player faction
     */
    private initializePlayerFaction(): void {
        const playerFaction: Faction = {
            id: this.PLAYER_FACTION_ID,
            name: 'Independent Captain',
            type: FactionType.Independent,
            description: 'Freelance spaceship captain',
            government: 'democracy',
            ideology: 'commercial',
            reputation: 0,
            stance: DiplomaticStance.Neutral,
            trustLevel: 50,
            power: 25,
            territory: [],
            resources: {
                military: 30,
                economic: 40,
                technological: 35,
                influence: 20
            },
            treaties: [],
            recentActions: [],
            personality: {
                aggression: 40,
                cooperation: 60,
                trustworthiness: 70,
                pride: 50,
                greed: 50,
                xenophobia: 20
            },
            isActive: true,
            lastContact: Date.now(),
            homeSystem: 'starting_system'
        };
        
        this.factions.set(this.PLAYER_FACTION_ID, playerFaction);
    }

    /**
     * Modify reputation with faction
     */
    modifyReputation(factionId: string, change: number, reason: string): void {
        const faction = this.factions.get(factionId);
        if (!faction) return;
        
        const oldReputation = faction.reputation;
        faction.reputation = Math.max(-100, Math.min(100, faction.reputation + change));
        
        // Update diplomatic stance based on new reputation
        faction.stance = this.calculateDiplomaticStance(faction.reputation);
        
        // Record diplomatic action
        this.recordDiplomaticAction({
            type: 'contact',
            actor: this.PLAYER_FACTION_ID,
            target: factionId,
            description: reason,
            reputationChange: change,
            successful: change > 0
        });
        
        this.events.onReputationChanged?.(factionId, oldReputation, faction.reputation);
        
        this.logger.info(`🤝 Reputation changed: ${faction.name} ${oldReputation} → ${faction.reputation} (${reason})`);
    }

    /**
     * Calculate diplomatic stance from reputation
     */
    private calculateDiplomaticStance(reputation: number): DiplomaticStance {
        if (reputation >= 80) return DiplomaticStance.Allied;
        if (reputation >= 40) return DiplomaticStance.Friendly;
        if (reputation >= -39) return DiplomaticStance.Neutral;
        if (reputation >= -79) return DiplomaticStance.Unfriendly;
        return DiplomaticStance.Hostile;
    }

    /**
     * Record diplomatic action
     */
    private recordDiplomaticAction(actionData: Omit<DiplomaticAction, 'id' | 'timestamp'>): void {
        const action: DiplomaticAction = {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            ...actionData
        };
        
        this.diplomaticActions.push(action);
        
        // Add to faction's recent actions
        const targetFaction = this.factions.get(actionData.target);
        if (targetFaction) {
            targetFaction.recentActions.push(action);
            
            // Keep only recent actions (last 10)
            if (targetFaction.recentActions.length > 10) {
                targetFaction.recentActions.shift();
            }
        }
    }

    /**
     * Start negotiation with faction
     */
    startNegotiation(
        factionId: string, 
        type: NegotiationType, 
        playerOffer: OfferTerm[],
        playerSkill: number = 50,
        crewBonus: number = 0
    ): NegotiationSession | null {
        const faction = this.factions.get(factionId);
        if (!faction) {
            this.logger.warn('Cannot start negotiation: faction not found', { factionId });
            return null;
        }
        
        // Check if negotiation is possible
        if (faction.stance === DiplomaticStance.War) {
            this.logger.warn('Cannot negotiate: factions at war', { factionId });
            return null;
        }
        
        const sessionId = `negotiation_${Date.now()}_${factionId}`;
        const reputationModifier = Math.floor(faction.reputation / 10); // -10 to +10
        
        const session: NegotiationSession = {
            id: sessionId,
            participants: [this.PLAYER_FACTION_ID, factionId],
            type,
            currentOffer: {
                proposer: this.PLAYER_FACTION_ID,
                terms: playerOffer,
                totalValue: this.calculateOfferValue(playerOffer),
                priority: this.calculateOfferPriority(type, faction)
            },
            rounds: 0,
            maxRounds: 5,
            status: 'active',
            playerSkill,
            crewBonus,
            reputationModifier
        };
        
        // Generate AI counter-offer
        session.counterOffer = this.generateCounterOffer(session, faction);
        
        this.negotiations.set(sessionId, session);
        this.events.onNegotiationStarted?.(session);
        
        this.logger.info(`💬 Negotiation started: ${faction.name} - ${type}`, {
            playerValue: session.currentOffer.totalValue,
            aiValue: session.counterOffer?.totalValue || 0
        });
        
        return session;
    }

    /**
     * Calculate offer value for AI evaluation
     */
    private calculateOfferValue(terms: OfferTerm[]): number {
        let totalValue = 0;
        
        terms.forEach(term => {
            switch (term.type) {
                case 'credits':
                    totalValue += term.value;
                    break;
                case 'items':
                    totalValue += term.value * 10; // Items worth more than credits
                    break;
                case 'information':
                    totalValue += term.value * 20; // Information is valuable
                    break;
                case 'technology':
                    totalValue += term.value * 50; // Technology is very valuable
                    break;
                case 'territory':
                    totalValue += term.value * 100; // Territory is extremely valuable
                    break;
                case 'service':
                    totalValue += term.value * 5;
                    break;
                case 'protection':
                    totalValue += term.value * 15;
                    break;
            }
        });
        
        return totalValue;
    }

    /**
     * Calculate how much faction wants this type of deal
     */
    private calculateOfferPriority(type: NegotiationType, faction: Faction): number {
        let priority = 50; // Base priority
        
        switch (type) {
            case NegotiationType.Trade:
                priority += faction.personality.greed * 0.3;
                priority += faction.resources.economic * 0.2;
                break;
            case NegotiationType.Alliance:
                priority += faction.personality.cooperation * 0.4;
                priority -= faction.personality.pride * 0.2;
                break;
            case NegotiationType.Technology:
                priority += (100 - faction.resources.technological) * 0.3;
                priority += faction.personality.cooperation * 0.2;
                break;
            case NegotiationType.SafePassage:
                priority += faction.personality.trustworthiness * 0.3;
                priority -= faction.personality.aggression * 0.2;
                break;
            case NegotiationType.Information:
                priority += faction.personality.cooperation * 0.2;
                priority += faction.resources.influence * 0.1;
                break;
        }
        
        // Reputation affects priority
        priority += faction.reputation * 0.2;
        
        return Math.max(0, Math.min(100, priority));
    }

    /**
     * Generate AI counter-offer
     */
    private generateCounterOffer(session: NegotiationSession, faction: Faction): NegotiationOffer {
        const playerOfferValue = session.currentOffer.totalValue;
        const factionDemand = this.calculateFactionDemand(session, faction);
        
        const counterTerms: OfferTerm[] = [];
        
        // AI wants something in return
        if (factionDemand > playerOfferValue) {
            const difference = factionDemand - playerOfferValue;
            
            // Request credits if greedy
            if (faction.personality.greed > 60) {
                counterTerms.push({
                    type: 'credits',
                    giver: this.PLAYER_FACTION_ID,
                    receiver: faction.id,
                    description: `Additional payment of ${difference} credits`,
                    value: difference
                });
            }
            // Request information if influence-focused
            else if (faction.resources.influence > 70) {
                counterTerms.push({
                    type: 'information',
                    giver: this.PLAYER_FACTION_ID,
                    receiver: faction.id,
                    description: 'Strategic intelligence data',
                    value: Math.floor(difference / 20)
                });
            }
            // Request service
            else {
                counterTerms.push({
                    type: 'service',
                    giver: this.PLAYER_FACTION_ID,
                    receiver: faction.id,
                    description: 'Future service commitment',
                    value: Math.floor(difference / 5)
                });
            }
        }
        
        // AI offers something back based on negotiation type
        if (session.type === NegotiationType.Trade) {
            counterTerms.push({
                type: 'credits',
                giver: faction.id,
                receiver: this.PLAYER_FACTION_ID,
                description: `Trade payment`,
                value: Math.floor(playerOfferValue * 0.8)
            });
        } else if (session.type === NegotiationType.Information) {
            counterTerms.push({
                type: 'information',
                giver: faction.id,
                receiver: this.PLAYER_FACTION_ID,
                description: 'Classified intelligence',
                value: Math.floor(playerOfferValue / 20)
            });
        }
        
        return {
            proposer: faction.id,
            terms: counterTerms,
            totalValue: this.calculateOfferValue(counterTerms),
            priority: session.currentOffer.priority
        };
    }

    /**
     * Calculate what faction demands in negotiation
     */
    private calculateFactionDemand(session: NegotiationSession, faction: Faction): number {
        let baseDemand = session.currentOffer.totalValue;
        
        // Faction personality affects demands
        baseDemand *= (1 + faction.personality.greed / 200); // 0.5x to 1.5x
        baseDemand *= (1 + faction.personality.pride / 300); // 0.67x to 1.33x
        
        // Reputation affects demands
        baseDemand *= (1 - faction.reputation / 200); // Better rep = lower demands
        
        // Power imbalance affects demands
        const playerFaction = this.factions.get(this.PLAYER_FACTION_ID)!;
        const powerRatio = faction.power / playerFaction.power;
        baseDemand *= Math.pow(powerRatio, 0.3); // Powerful factions demand more
        
        return Math.floor(baseDemand);
    }

    /**
     * Continue negotiation with player response
     */
    continueNegotiation(
        sessionId: string, 
        acceptCounter: boolean, 
        newOffer?: OfferTerm[]
    ): NegotiationSession | null {
        const session = this.negotiations.get(sessionId);
        if (!session || session.status !== 'active') return null;
        
        const faction = this.factions.get(session.participants[1]);
        if (!faction) return null;
        
        session.rounds++;
        
        if (acceptCounter && session.counterOffer) {
            // Player accepted AI's counter-offer
            session.status = 'successful';
            this.applyNegotiationResults(session, session.counterOffer);
            this.events.onNegotiationCompleted?.(session, true);
            
            this.logger.info(`✅ Negotiation successful: ${faction.name}`);
            
        } else if (newOffer && session.rounds < session.maxRounds) {
            // Player made counter-offer
            session.currentOffer = {
                proposer: this.PLAYER_FACTION_ID,
                terms: newOffer,
                totalValue: this.calculateOfferValue(newOffer),
                priority: session.currentOffer.priority
            };
            
            // AI evaluates new offer
            const acceptChance = this.calculateAIAcceptanceChance(session, faction);
            
            if (Math.random() < acceptChance) {
                session.status = 'successful';
                this.applyNegotiationResults(session, session.currentOffer);
                this.events.onNegotiationCompleted?.(session, true);
                
                this.logger.info(`✅ AI accepted negotiation: ${faction.name}`);
            } else {
                // Generate new counter-offer
                session.counterOffer = this.generateCounterOffer(session, faction);
            }
            
        } else {
            // Negotiation failed
            session.status = 'failed';
            this.modifyReputation(faction.id, -5, 'Failed negotiation');
            this.events.onNegotiationCompleted?.(session, false);
            
            this.logger.info(`❌ Negotiation failed: ${faction.name}`);
        }
        
        return session;
    }

    /**
     * Calculate AI acceptance chance for player offer
     */
    private calculateAIAcceptanceChance(session: NegotiationSession, faction: Faction): number {
        const offerValue = session.currentOffer.totalValue;
        const demandValue = this.calculateFactionDemand(session, faction);
        
        let acceptanceChance = 0.5; // Base 50%
        
        // Value comparison
        const valueRatio = offerValue / demandValue;
        acceptanceChance += (valueRatio - 1) * 0.3; // ±30% based on value
        
        // Faction personality
        acceptanceChance += faction.personality.cooperation / 200; // +0% to +50%
        acceptanceChance -= faction.personality.pride / 300; // -0% to -33%
        
        // Reputation bonus
        acceptanceChance += faction.reputation / 200; // -50% to +50%
        
        // Player skill bonus
        acceptanceChance += session.playerSkill / 200; // +0% to +50%
        acceptanceChance += session.crewBonus / 100; // Crew diplomatic bonuses
        
        // Negotiation rounds penalty (AI gets impatient)
        acceptanceChance -= session.rounds * 0.1;
        
        return Math.max(0.05, Math.min(0.95, acceptanceChance));
    }

    /**
     * Apply results of successful negotiation
     */
    private applyNegotiationResults(session: NegotiationSession, agreedOffer: NegotiationOffer): void {
        // Apply reputation bonus for successful negotiation
        const otherFaction = session.participants.find(id => id !== this.PLAYER_FACTION_ID);
        if (otherFaction) {
            this.modifyReputation(otherFaction, 10, 'Successful negotiation');
        }
        
        // TODO: Apply actual offer terms (credits, items, etc.)
        // This would integrate with inventory, research, etc.
        
        this.recordDiplomaticAction({
            type: 'trade',
            actor: this.PLAYER_FACTION_ID,
            target: otherFaction!,
            description: `Successful ${session.type} negotiation`,
            reputationChange: 10,
            successful: true
        });
    }

    /**
     * Generate random diplomatic encounter
     */
    generateRandomEncounter(playerPosition: { x: number, y: number }): DiplomaticEncounter | null {
        const activeFactions = Array.from(this.factions.values()).filter(f => 
            f.id !== this.PLAYER_FACTION_ID && f.isActive
        );
        
        if (activeFactions.length === 0) return null;
        
        const faction = activeFactions[Math.floor(Math.random() * activeFactions.length)];
        const encounterTypes = ['routine_patrol', 'distress_call', 'trade_opportunity', 'territorial_dispute'];
        const encounterType = encounterTypes[Math.floor(Math.random() * encounterTypes.length)] as DiplomaticEncounter['type'];
        
        const encounter: DiplomaticEncounter = {
            id: `encounter_${Date.now()}_${faction.id}`,
            factionId: faction.id,
            type: encounterType,
            location: { ...playerPosition },
            description: this.generateEncounterDescription(faction, encounterType),
            availableActions: this.generateEncounterActions(faction, encounterType),
            consequences: [],
            isActive: true,
            timestamp: Date.now()
        };
        
        this.encounters.set(encounter.id, encounter);
        this.events.onEncounterGenerated?.(encounter);
        
        this.logger.info(`🎭 Diplomatic encounter: ${faction.name} - ${encounterType}`);
        
        return encounter;
    }

    /**
     * Generate encounter description
     */
    private generateEncounterDescription(faction: Faction, type: DiplomaticEncounter['type']): string {
        const descriptions = {
            routine_patrol: [
                `A ${faction.name} patrol vessel approaches your ship`,
                `${faction.name} forces are conducting routine inspections in this sector`,
                `You encounter a ${faction.name} security checkpoint`
            ],
            distress_call: [
                `A ${faction.name} ship is transmitting a distress signal`,
                `${faction.name} vessel appears to be disabled and requesting assistance`,
                `Emergency beacon from ${faction.name} ship detected`
            ],
            trade_opportunity: [
                `${faction.name} trader wishes to conduct business`,
                `A ${faction.name} merchant convoy has goods to trade`,
                `${faction.name} commercial vessel offers trade opportunity`
            ],
            territorial_dispute: [
                `${faction.name} claims this space as their territory`,
                `${faction.name} forces demand you leave their space immediately`,
                `You have entered disputed ${faction.name} territory`
            ],
            first_contact: [
                `First contact with unknown ${faction.name} vessel`,
                `${faction.name} ship of unknown configuration approaches`,
                `Unprecedented encounter with ${faction.name} representatives`
            ]
        };
        
        const typeDescriptions = descriptions[type] || descriptions.routine_patrol;
        return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
    }

    /**
     * Generate encounter actions
     */
    private generateEncounterActions(faction: Faction, type: DiplomaticEncounter['type']): EncounterAction[] {
        const baseActions: EncounterAction[] = [
            {
                id: 'diplomatic_greeting',
                name: 'Diplomatic Greeting',
                description: 'Approach peacefully and initiate diplomatic contact',
                skillCheck: { skill: 'communications', difficulty: 30 },
                consequences: [
                    {
                        type: 'reputation',
                        factionId: faction.id,
                        value: 5,
                        description: 'Peaceful approach improves relations'
                    }
                ]
            },
            {
                id: 'ignore_encounter',
                name: 'Ignore and Continue',
                description: 'Ignore the encounter and continue on your course',
                consequences: [
                    {
                        type: 'reputation',
                        factionId: faction.id,
                        value: -2,
                        description: 'Ignoring faction vessel causes minor offense'
                    }
                ]
            }
        ];
        
        // Add type-specific actions
        switch (type) {
            case 'distress_call':
                baseActions.push({
                    id: 'offer_assistance',
                    name: 'Offer Assistance',
                    description: 'Provide aid to the distressed vessel',
                    skillCheck: { skill: 'engineering', difficulty: 40 },
                    consequences: [
                        {
                            type: 'reputation',
                            factionId: faction.id,
                            value: 15,
                            description: 'Humanitarian aid greatly improves relations'
                        },
                        {
                            type: 'resources',
                            factionId: faction.id,
                            value: 100,
                            description: 'Faction rewards your assistance'
                        }
                    ]
                });
                break;
                
            case 'trade_opportunity':
                baseActions.push({
                    id: 'initiate_trade',
                    name: 'Initiate Trade',
                    description: 'Begin trade negotiations',
                    consequences: [
                        {
                            type: 'trade_opportunity',
                            factionId: faction.id,
                            value: 1,
                            description: 'Opens trade dialogue'
                        }
                    ]
                });
                break;
                
            case 'territorial_dispute':
                baseActions.push({
                    id: 'negotiate_passage',
                    name: 'Negotiate Safe Passage',
                    description: 'Attempt to negotiate peaceful passage through their territory',
                    requirements: [
                        { type: 'reputation', value: 0, description: 'Neutral or better standing required' }
                    ],
                    skillCheck: { skill: 'communications', difficulty: 50 },
                    consequences: [
                        {
                            type: 'reputation',
                            factionId: faction.id,
                            value: 8,
                            description: 'Successful negotiation improves relations'
                        }
                    ]
                });
                break;
        }
        
        // Add hostile option if reputation is very low
        if (faction.reputation < -50) {
            baseActions.push({
                id: 'threaten_withdrawal',
                name: 'Threaten Force',
                description: 'Threaten to use force if they do not withdraw',
                requirements: [
                    { type: 'crew_skill', value: 60, description: 'High combat skill required' }
                ],
                consequences: [
                    {
                        type: 'combat',
                        factionId: faction.id,
                        value: 1,
                        description: 'May escalate to combat'
                    },
                    {
                        type: 'reputation',
                        factionId: faction.id,
                        value: -20,
                        description: 'Threatening behavior severely damages relations'
                    }
                ]
            });
        }
        
        return baseActions;
    }

    /**
     * Resolve encounter action
     */
    resolveEncounterAction(encounterId: string, actionId: string, skillValue: number = 50): EncounterConsequence[] {
        const encounter = this.encounters.get(encounterId);
        if (!encounter || !encounter.isActive) return [];
        
        const action = encounter.availableActions.find(a => a.id === actionId);
        if (!action) return [];
        
        const consequences: EncounterConsequence[] = [...action.consequences];
        
        // Handle skill check
        if (action.skillCheck) {
            const success = skillValue >= action.skillCheck.difficulty;
            
            if (success) {
                // Bonus for skill success
                consequences.forEach(c => {
                    if (c.type === 'reputation' && c.value > 0) {
                        c.value = Math.floor(c.value * 1.5); // 50% bonus
                    }
                });
            } else {
                // Penalty for skill failure
                consequences.forEach(c => {
                    if (c.type === 'reputation') {
                        c.value = Math.floor(c.value * 0.5); // 50% penalty
                    }
                });
            }
        }
        
        // Apply consequences
        consequences.forEach(consequence => {
            switch (consequence.type) {
                case 'reputation':
                    this.modifyReputation(consequence.factionId, consequence.value, consequence.description);
                    break;
                case 'combat':
                    // TODO: Trigger combat encounter
                    break;
                case 'trade_opportunity':
                    // TODO: Open trade interface
                    break;
            }
        });
        
        // Mark encounter as resolved
        encounter.isActive = false;
        encounter.consequences = consequences;
        
        if (consequences.some(c => c.type === 'combat')) {
            encounter.resolution = 'hostile';
        } else if (consequences.some(c => c.type === 'reputation' && c.value > 0)) {
            encounter.resolution = 'beneficial';
        } else {
            encounter.resolution = 'neutral';
        }
        
        this.logger.info(`🎯 Encounter resolved: ${actionId}`, {
            consequences: consequences.length,
            resolution: encounter.resolution
        });
        
        return consequences;
    }

    /**
     * Get faction by ID
     */
    getFaction(factionId: string): Faction | null {
        return this.factions.get(factionId) || null;
    }

    /**
     * Get all factions
     */
    getAllFactions(): Faction[] {
        return Array.from(this.factions.values()).filter(f => f.id !== this.PLAYER_FACTION_ID);
    }

    /**
     * Get player faction
     */
    getPlayerFaction(): Faction {
        return this.factions.get(this.PLAYER_FACTION_ID)!;
    }

    /**
     * Get active negotiations
     */
    getActiveNegotiations(): NegotiationSession[] {
        return Array.from(this.negotiations.values()).filter(n => n.status === 'active');
    }

    /**
     * Get active encounters
     */
    getActiveEncounters(): DiplomaticEncounter[] {
        return Array.from(this.encounters.values()).filter(e => e.isActive);
    }

    /**
     * Get recent diplomatic actions
     */
    getRecentDiplomaticActions(limit: number = 10): DiplomaticAction[] {
        return this.diplomaticActions
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Get diplomacy statistics
     */
    getDiplomacyStats(): {
        totalFactions: number;
        alliedFactions: number;
        hostileFactions: number;
        activeNegotiations: number;
        activeTreaties: number;
        totalEncounters: number;
        averageReputation: number;
    } {
        const factions = this.getAllFactions();
        const allied = factions.filter(f => f.stance === DiplomaticStance.Allied).length;
        const hostile = factions.filter(f => f.stance === DiplomaticStance.Hostile || f.stance === DiplomaticStance.War).length;
        const avgReputation = factions.reduce((sum, f) => sum + f.reputation, 0) / factions.length;
        
        return {
            totalFactions: factions.length,
            alliedFactions: allied,
            hostileFactions: hostile,
            activeNegotiations: this.getActiveNegotiations().length,
            activeTreaties: Array.from(this.treaties.values()).filter(t => t.status === 'active').length,
            totalEncounters: this.encounters.size,
            averageReputation: Math.round(avgReputation)
        };
    }

    /**
     * Save diplomacy data
     */
    saveDiplomacyData(): any {
        return {
            factions: Array.from(this.factions.entries()),
            treaties: Array.from(this.treaties.entries()),
            negotiations: Array.from(this.negotiations.entries()),
            encounters: Array.from(this.encounters.entries()),
            diplomaticActions: this.diplomaticActions
        };
    }

    /**
     * Load diplomacy data
     */
    loadDiplomacyData(data: any): void {
        if (data.factions) {
            this.factions = new Map(data.factions);
        }
        if (data.treaties) {
            this.treaties = new Map(data.treaties);
        }
        if (data.negotiations) {
            this.negotiations = new Map(data.negotiations);
        }
        if (data.encounters) {
            this.encounters = new Map(data.encounters);
        }
        if (data.diplomaticActions) {
            this.diplomaticActions = data.diplomaticActions;
        }
        
        this.logger.info('🤝 Diplomacy data loaded', {
            factions: this.factions.size,
            treaties: this.treaties.size,
            encounters: this.encounters.size
        });
    }
}