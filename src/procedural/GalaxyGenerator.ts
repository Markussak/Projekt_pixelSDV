/**
 * Galaxy Generation Engine
 * Creates realistic spiral galaxies with procedural star systems
 */

import { Vector2 } from '@core/Renderer';
import { Logger } from '@utils/Logger';

export interface GalaxyConfig {
    seed: number;
    size: number; // Galaxy radius in light years
    starCount: number;
    spiralArms: number;
    armTightness: number; // How tightly wound the spiral arms are
    coreSize: number; // Size of the galactic core
    starDensity: number; // Stars per cubic light year
}

export interface StarData {
    id: string;
    name: string;
    position: Vector2; // Position in galaxy (light years)
    type: StarType;
    mass: number; // Solar masses
    luminosity: number; // Solar luminosities
    temperature: number; // Kelvin
    age: number; // Million years
    metallicity: number; // 0-1, higher = more heavy elements
    
    // Visual properties
    color: { r: number; g: number; b: number };
    brightness: number; // 0-1 for rendering
    radius: number; // Solar radii
}

export interface PlanetData {
    id: string;
    name: string;
    starId: string;
    orbitDistance: number; // AU from star
    orbitPeriod: number; // Days
    radius: number; // Earth radii
    mass: number; // Earth masses
    type: PlanetType;
    temperature: number; // Kelvin
    hasAtmosphere: boolean;
    atmosphereType?: AtmosphereType;
    hasRings: boolean;
    moons: MoonData[];
    
    // Surface properties
    surfaceType: SurfaceType;
    surfaceColor: { r: number; g: number; b: number };
    hasWater: boolean;
    hasLife: boolean;
}

export interface MoonData {
    id: string;
    name: string;
    planetId: string;
    orbitDistance: number; // Planet radii
    orbitPeriod: number; // Hours
    radius: number; // Earth radii
    mass: number; // Earth masses
    type: 'rocky' | 'icy' | 'captured_asteroid';
    tidallyLocked: boolean;
}

export interface StarSystemData {
    id: string;
    name: string;
    position: Vector2;
    star: StarData;
    planets: PlanetData[];
    asteroidBelts: AsteroidBeltData[];
    
    // System properties
    habitableZoneInner: number; // AU
    habitableZoneOuter: number; // AU
    systemAge: number; // Million years
    metallicity: number;
    
    // Generated objects
    stations?: SpaceStationData[];
    anomalies?: AnomalyData[];
}

export enum StarType {
    O = 'O', // Blue supergiant
    B = 'B', // Blue giant
    A = 'A', // White
    F = 'F', // Yellow-white
    G = 'G', // Yellow (like Sun)
    K = 'K', // Orange
    M = 'M', // Red dwarf
    WD = 'WD', // White dwarf
    NS = 'NS', // Neutron star
    BH = 'BH'  // Black hole
}

export enum PlanetType {
    Terrestrial = 'terrestrial',
    GasGiant = 'gas_giant',
    IceGiant = 'ice_giant',
    Desert = 'desert',
    Ocean = 'ocean',
    Volcanic = 'volcanic',
    Frozen = 'frozen',
    Toxic = 'toxic'
}

export enum SurfaceType {
    Rocky = 'rocky',
    Desert = 'desert',
    Ocean = 'ocean',
    Ice = 'ice',
    Lava = 'lava',
    Gas = 'gas',
    Toxic = 'toxic',
    Crystalline = 'crystalline'
}

export enum AtmosphereType {
    None = 'none',
    Thin = 'thin',
    Thick = 'thick',
    Toxic = 'toxic',
    Methane = 'methane',
    Hydrogen = 'hydrogen',
    CarbonDioxide = 'carbon_dioxide'
}

interface AsteroidBeltData {
    id: string;
    innerRadius: number; // AU
    outerRadius: number; // AU
    density: number; // 0-1
    composition: 'rocky' | 'metallic' | 'icy';
}

interface SpaceStationData {
    id: string;
    name: string;
    position: Vector2;
    type: 'trading' | 'mining' | 'research' | 'military' | 'abandoned';
    faction: string;
    population: number;
}

interface AnomalyData {
    id: string;
    name: string;
    position: Vector2;
    type: 'wormhole' | 'nebula' | 'supernova_remnant' | 'dark_matter' | 'ancient_artifact';
    strength: number; // 0-1
}

export class GalaxyGenerator {
    private config: GalaxyConfig;
    private random: SeededRandom;
    private logger: Logger;
    
    // Galaxy data
    private stars: Map<string, StarData> = new Map();
    private starSystems: Map<string, StarSystemData> = new Map();
    private galaxyMap: StarData[] = [];

    constructor(config: Partial<GalaxyConfig> = {}) {
        this.logger = new Logger('GalaxyGenerator');
        
        // Default galaxy configuration
        this.config = {
            seed: 42,
            size: 50000, // 50,000 light years radius
            starCount: 50, // Reduced for web performance
            spiralArms: 4,
            armTightness: 0.3,
            coreSize: 5000, // 5,000 light years
            starDensity: 0.1,
            ...config
        };
        
        this.random = new SeededRandom(this.config.seed);
        
        this.logger.info('🌌 Galaxy generator initialized', {
            seed: this.config.seed,
            size: this.config.size,
            starCount: this.config.starCount
        });
    }

    /**
     * Generate the entire galaxy
     */
    async generateGalaxy(progressCallback?: (progress: number, message: string) => void): Promise<void> {
        this.logger.info('🔄 Generating galaxy...');
        
        const startTime = performance.now();
        
        try {
            // Generate star positions using spiral galaxy model
            progressCallback?.(10, 'Creating star positions...');
            this.generateStarPositions();
            
            // Generate star properties
            progressCallback?.(30, 'Calculating stellar properties...');
            this.generateStarProperties();
            
            // Generate star systems (planets, moons, etc.)
            progressCallback?.(50, 'Generating planetary systems...');
            await this.generateStarSystems(progressCallback);
            
            // Generate special objects and anomalies
            progressCallback?.(90, 'Adding cosmic anomalies...');
            this.generateAnomalies();
            
            progressCallback?.(100, 'Galaxy generation complete!');
            
            const endTime = performance.now();
            this.logger.info(`✅ Galaxy generated in ${(endTime - startTime).toFixed(2)}ms`, {
                stars: this.stars.size,
                systems: this.starSystems.size
            });
            
        } catch (error) {
            this.logger.error('❌ Galaxy generation failed', error);
            throw error;
        }
    }

    /**
     * Generate star positions using spiral galaxy model
     */
    private generateStarPositions(): void {
        this.logger.debug('Generating star positions...');
        
        for (let i = 0; i < this.config.starCount; i++) {
            const position = this.generateSpiralPosition(i);
            const starId = `star_${i.toString().padStart(4, '0')}`;
            
            // Create basic star data (properties will be added later)
            const star: StarData = {
                id: starId,
                name: this.generateStarName(i),
                position: position,
                type: StarType.G, // Will be determined later
                mass: 1.0,
                luminosity: 1.0,
                temperature: 5778,
                age: 4600,
                metallicity: 0.02,
                color: { r: 255, g: 255, b: 255 },
                brightness: 1.0,
                radius: 1.0
            };
            
            this.stars.set(starId, star);
            this.galaxyMap.push(star);
        }
        
        this.logger.debug(`Generated ${this.stars.size} star positions`);
    }

    /**
     * Generate position using spiral galaxy model
     */
    private generateSpiralPosition(index: number): Vector2 {
        // Distance from galactic center (0 = center, 1 = edge)
        const normalizedRadius = Math.pow(this.random.next(), 0.7); // Power law distribution
        const radius = normalizedRadius * this.config.size;
        
        // Determine which spiral arm
        const armIndex = Math.floor(this.random.next() * this.config.spiralArms);
        const armAngleOffset = (armIndex * 2 * Math.PI) / this.config.spiralArms;
        
        // Spiral angle based on distance from center
        const spiralAngle = armAngleOffset + normalizedRadius * this.config.armTightness * 4 * Math.PI;
        
        // Add some random offset to make it less perfect
        const angleNoise = (this.random.next() - 0.5) * 0.5;
        const radiusNoise = (this.random.next() - 0.5) * 0.2 * radius;
        
        const finalAngle = spiralAngle + angleNoise;
        const finalRadius = Math.max(0, radius + radiusNoise);
        
        return {
            x: Math.cos(finalAngle) * finalRadius,
            y: Math.sin(finalAngle) * finalRadius
        };
    }

    /**
     * Generate star names using procedural naming
     */
    private generateStarName(index: number): string {
        const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
        const suffixes = ['Centauri', 'Draconis', 'Lyrae', 'Cygni', 'Aquilae', 'Orionis', 'Ursae', 'Cassiopeiae'];
        
        const prefix = prefixes[index % prefixes.length];
        const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];
        const number = Math.floor(index / (prefixes.length * suffixes.length)) + 1;
        
        return number > 1 ? `${prefix} ${suffix} ${number}` : `${prefix} ${suffix}`;
    }

    /**
     * Generate star properties based on stellar evolution
     */
    private generateStarProperties(): void {
        this.logger.debug('Generating star properties...');
        
        for (const star of this.stars.values()) {
            // Determine star type based on galactic position and random factors
            const distanceFromCore = Math.sqrt(star.position.x ** 2 + star.position.y ** 2);
            const coreInfluence = Math.max(0, 1 - distanceFromCore / this.config.coreSize);
            
            // Metallicity increases closer to galactic center
            star.metallicity = Math.max(0.001, 0.02 * (0.5 + coreInfluence * 0.5) * this.random.range(0.5, 1.5));
            
            // Generate stellar mass (affects everything else)
            star.mass = this.generateStellarMass();
            
            // Determine star type from mass
            star.type = this.getStarTypeFromMass(star.mass);
            
            // Calculate other properties
            star.luminosity = this.calculateLuminosity(star.mass, star.type);
            star.temperature = this.calculateTemperature(star.mass, star.type);
            star.radius = this.calculateRadius(star.mass, star.luminosity, star.temperature);
            star.age = this.generateStellarAge(star.mass, star.type);
            
            // Visual properties
            star.color = this.getStarColor(star.temperature);
            star.brightness = Math.min(1.0, star.luminosity / 100); // Scale for visibility
        }
        
        this.logger.debug('Star properties generated');
    }

    /**
     * Generate stellar mass using realistic distribution
     */
    private generateStellarMass(): number {
        // Salpeter initial mass function approximation
        const x = this.random.next();
        if (x < 0.8) {
            // Low mass stars (0.1 - 0.8 solar masses)
            return 0.1 + (0.7 * Math.pow(x / 0.8, 2));
        } else if (x < 0.95) {
            // Medium mass stars (0.8 - 3 solar masses)
            return 0.8 + (2.2 * Math.pow((x - 0.8) / 0.15, 1.5));
        } else {
            // High mass stars (3 - 50 solar masses)
            return 3 + (47 * Math.pow((x - 0.95) / 0.05, 3));
        }
    }

    /**
     * Determine star type from mass
     */
    private getStarTypeFromMass(mass: number): StarType {
        if (mass > 30) return StarType.O;
        if (mass > 10) return StarType.B;
        if (mass > 2.5) return StarType.A;
        if (mass > 1.4) return StarType.F;
        if (mass > 0.8) return StarType.G;
        if (mass > 0.5) return StarType.K;
        return StarType.M;
    }

    /**
     * Calculate luminosity from mass and type
     */
    private calculateLuminosity(mass: number, type: StarType): number {
        // Mass-luminosity relation: L ∝ M^α
        let alpha = 3.5; // Default for main sequence
        
        switch (type) {
            case StarType.O:
            case StarType.B:
                alpha = 4.0;
                break;
            case StarType.A:
            case StarType.F:
                alpha = 3.5;
                break;
            case StarType.G:
                alpha = 4.0;
                break;
            case StarType.K:
            case StarType.M:
                alpha = 2.3;
                break;
        }
        
        return Math.pow(mass, alpha);
    }

    /**
     * Calculate temperature from mass and type
     */
    private calculateTemperature(mass: number, type: StarType): number {
        const baseTemps = {
            [StarType.O]: 35000,
            [StarType.B]: 20000,
            [StarType.A]: 8500,
            [StarType.F]: 6500,
            [StarType.G]: 5500,
            [StarType.K]: 4000,
            [StarType.M]: 3000
        };
        
        const baseTemp = (baseTemps as any)[type] || 5500;
        return baseTemp * this.random.range(0.9, 1.1);
    }

    /**
     * Calculate radius from mass, luminosity, and temperature
     */
    private calculateRadius(mass: number, luminosity: number, temperature: number): number {
        // Stefan-Boltzmann law: L = 4πR²σT⁴
        // R ∝ √(L/T⁴)
        const solarTemp = 5778;
        return Math.sqrt(luminosity) * Math.pow(solarTemp / temperature, 2);
    }

    /**
     * Generate stellar age
     */
    private generateStellarAge(mass: number, type: StarType): number {
        // Main sequence lifetime ∝ M/L ∝ M^(-2.5)
        const solarLifetime = 10000; // Million years
        const lifetime = solarLifetime * Math.pow(mass, -2.5);
        
        // Random age between 0 and lifetime
        return this.random.next() * lifetime;
    }

    /**
     * Get star color from temperature
     */
    private getStarColor(temperature: number): { r: number; g: number; b: number } {
        // Simplified blackbody color approximation
        if (temperature > 25000) return { r: 155, g: 176, b: 255 }; // Blue
        if (temperature > 10000) return { r: 202, g: 215, b: 255 }; // Blue-white
        if (temperature > 7500) return { r: 248, g: 247, b: 255 };  // White
        if (temperature > 6000) return { r: 255, g: 244, b: 234 };  // Yellow-white
        if (temperature > 5000) return { r: 255, g: 214, b: 170 };  // Yellow
        if (temperature > 3500) return { r: 255, g: 204, b: 111 };  // Orange
        return { r: 255, g: 204, b: 111 }; // Red
    }

    /**
     * Generate complete star systems
     */
    private async generateStarSystems(progressCallback?: (progress: number, message: string) => void): Promise<void> {
        this.logger.debug('Generating star systems...');
        
        let systemCount = 0;
        const stars = Array.from(this.stars.values());
        
        // Use larger batch size but with async yielding for better performance
        const batchSize = Math.max(10, Math.floor(stars.length / 20)); // Dynamic batch size
        
        for (let i = 0; i < stars.length; i += batchSize) {
            const batch = stars.slice(i, i + batchSize);
            
            // Process batch synchronously for speed, but yield periodically
            for (const star of batch) {
                // Not all stars have planetary systems
                if (this.random.next() < 0.6) { // Reduced to 60% for faster generation
                    const system = this.generateStarSystemSync(star); // Use sync version for speed
                    this.starSystems.set(star.id, system);
                    systemCount++;
                }
            }
            
            // Yield control periodically to prevent blocking
            if (i % (batchSize * 5) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            // Update progress
            const progress = 50 + Math.floor((i / stars.length) * 35); // 50-85% range
            progressCallback?.(progress, `Generated ${systemCount} star systems...`);
            
            // Yield control to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        this.logger.debug(`Generated ${systemCount} star systems`);
    }

    /**
     * Generate a single star system (synchronous version for performance)
     */
    private generateStarSystemSync(star: StarData): StarSystemData {
        return this.generateStarSystemInternal(star);
    }

    /**
     * Generate a single star system
     */
    private async generateStarSystem(star: StarData): Promise<StarSystemData> {
        return this.generateStarSystemInternal(star);
    }

    /**
     * Internal star system generation logic
     */
    private generateStarSystemInternal(star: StarData): StarSystemData {
        const system: StarSystemData = {
            id: star.id,
            name: `${star.name} System`,
            position: star.position,
            star: star,
            planets: [],
            asteroidBelts: [],
            habitableZoneInner: 0,
            habitableZoneOuter: 0,
            systemAge: star.age,
            metallicity: star.metallicity
        };
        
        // Calculate habitable zone
        const luminosity = star.luminosity;
        system.habitableZoneInner = Math.sqrt(luminosity / 1.1);
        system.habitableZoneOuter = Math.sqrt(luminosity / 0.53);
        
        // Generate planets
        const planetCount = Math.floor(this.random.range(0, 8));
        let currentOrbit = this.random.range(0.1, 0.5); // Start close to star
        
        for (let i = 0; i < planetCount; i++) {
            const planet = this.generatePlanet(star, system, i, currentOrbit);
            system.planets.push(planet);
            
            // Space out orbits realistically
            currentOrbit *= this.random.range(1.4, 2.0);
        }
        
        // Generate asteroid belts
        if (this.random.next() < 0.3) { // 30% chance
            system.asteroidBelts.push({
                id: `${star.id}_belt_1`,
                innerRadius: currentOrbit,
                outerRadius: currentOrbit * 1.5,
                density: this.random.range(0.3, 0.8),
                composition: this.random.choice(['rocky', 'metallic', 'icy'])
            });
        }
        
        return system;
    }

    /**
     * Generate a planet
     */
    private generatePlanet(star: StarData, system: StarSystemData, index: number, orbitDistance: number): PlanetData {
        const planetId = `${star.id}_planet_${index}`;
        
        // Determine planet type based on distance from star
        let planetType: PlanetType;
        if (orbitDistance < system.habitableZoneInner * 0.5) {
            planetType = PlanetType.Volcanic;
        } else if (orbitDistance > system.habitableZoneOuter * 2) {
            planetType = this.random.choice([PlanetType.GasGiant, PlanetType.IceGiant, PlanetType.Frozen]);
        } else if (orbitDistance >= system.habitableZoneInner && orbitDistance <= system.habitableZoneOuter) {
            planetType = this.random.choice([PlanetType.Terrestrial, PlanetType.Ocean, PlanetType.Desert]);
        } else {
            planetType = this.random.choice([PlanetType.Terrestrial, PlanetType.Desert, PlanetType.Frozen]);
        }
        
        // Calculate planet properties
        const mass = this.generatePlanetMass(planetType);
        const radius = this.calculatePlanetRadius(mass, planetType);
        const temperature = this.calculatePlanetTemperature(star, orbitDistance);
        
        const planet: PlanetData = {
            id: planetId,
            name: `${star.name} ${this.numberToRoman(index + 1)}`,
            starId: star.id,
            orbitDistance: orbitDistance,
            orbitPeriod: this.calculateOrbitPeriod(orbitDistance, star.mass),
            radius: radius,
            mass: mass,
            type: planetType,
            temperature: temperature,
            hasAtmosphere: this.determineAtmosphere(planetType, mass, temperature),
            hasRings: this.random.next() < 0.1, // 10% chance
            moons: [],
            surfaceType: this.determineSurfaceType(planetType, temperature),
            surfaceColor: this.generateSurfaceColor(planetType),
            hasWater: temperature > 273 && temperature < 373 && planetType !== PlanetType.GasGiant,
            hasLife: false // Will be determined later
        };
        
        // Determine atmosphere type
        if (planet.hasAtmosphere) {
            planet.atmosphereType = this.determineAtmosphereType(planetType, temperature);
        }
        
        // Generate moons
        const moonCount = this.generateMoonCount(planetType, mass);
        for (let j = 0; j < moonCount; j++) {
            planet.moons.push(this.generateMoon(planet, j));
        }
        
        return planet;
    }

    /**
     * Generate planet mass based on type
     */
    private generatePlanetMass(type: PlanetType): number {
        switch (type) {
            case PlanetType.GasGiant:
                return this.random.range(50, 500); // Earth masses
            case PlanetType.IceGiant:
                return this.random.range(10, 50);
            case PlanetType.Terrestrial:
            case PlanetType.Ocean:
            case PlanetType.Desert:
            case PlanetType.Volcanic:
            case PlanetType.Frozen:
            case PlanetType.Toxic:
                return this.random.range(0.1, 3.0);
            default:
                return 1.0;
        }
    }

    /**
     * Calculate planet radius from mass and type
     */
    private calculatePlanetRadius(mass: number, type: PlanetType): number {
        if (type === PlanetType.GasGiant || type === PlanetType.IceGiant) {
            return Math.pow(mass, 0.27); // Gas giants have different mass-radius relation
        } else {
            return Math.pow(mass, 0.27); // Rocky planets
        }
    }

    /**
     * Calculate planet temperature
     */
    private calculatePlanetTemperature(star: StarData, distance: number): number {
        // Simplified temperature calculation
        const solarConstant = star.luminosity / (distance * distance);
        const baseTemp = 278.5 * Math.pow(solarConstant, 0.25); // Effective temperature
        
        // Add some randomness for atmosphere effects
        return baseTemp * this.random.range(0.8, 1.2);
    }

    /**
     * Calculate orbit period using Kepler's laws
     */
    private calculateOrbitPeriod(distance: number, starMass: number): number {
        // T² ∝ a³/M (in Earth years)
        return Math.sqrt(Math.pow(distance, 3) / starMass) * 365.25; // Convert to days
    }

    /**
     * Generate other helper methods...
     */
    private determineAtmosphere(type: PlanetType, mass: number, temperature: number): boolean {
        if (type === PlanetType.GasGiant || type === PlanetType.IceGiant) return true;
        if (mass < 0.1) return false; // Too small to hold atmosphere
        if (temperature > 2000) return false; // Too hot
        return this.random.next() < 0.7;
    }

    private determineSurfaceType(type: PlanetType, temperature: number): SurfaceType {
        switch (type) {
            case PlanetType.Ocean: return SurfaceType.Ocean;
            case PlanetType.Desert: return SurfaceType.Desert;
            case PlanetType.Volcanic: return SurfaceType.Lava;
            case PlanetType.Frozen: return SurfaceType.Ice;
            case PlanetType.GasGiant:
            case PlanetType.IceGiant: return SurfaceType.Gas;
            case PlanetType.Toxic: return SurfaceType.Toxic;
            default: return SurfaceType.Rocky;
        }
    }

    private generateSurfaceColor(type: PlanetType): { r: number; g: number; b: number } {
        switch (type) {
            case PlanetType.Ocean: return { r: 0, g: 100, b: 200 };
            case PlanetType.Desert: return { r: 200, g: 150, b: 100 };
            case PlanetType.Volcanic: return { r: 150, g: 50, b: 0 };
            case PlanetType.Frozen: return { r: 200, g: 220, b: 255 };
            case PlanetType.GasGiant: return { r: 180, g: 140, b: 100 };
            case PlanetType.IceGiant: return { r: 100, g: 150, b: 200 };
            case PlanetType.Toxic: return { r: 100, g: 150, b: 50 };
            default: return { r: 120, g: 100, b: 80 };
        }
    }

    private determineAtmosphereType(type: PlanetType, temperature: number): AtmosphereType {
        if (temperature > 1000) return AtmosphereType.Toxic;
        if (type === PlanetType.GasGiant) return AtmosphereType.Hydrogen;
        if (type === PlanetType.IceGiant) return AtmosphereType.Methane;
        if (temperature < 200) return AtmosphereType.Thin;
        return AtmosphereType.CarbonDioxide;
    }

    private generateMoonCount(planetType: PlanetType, mass: number): number {
        if (planetType === PlanetType.GasGiant) return Math.floor(this.random.range(5, 20));
        if (planetType === PlanetType.IceGiant) return Math.floor(this.random.range(2, 10));
        if (mass > 1.0) return Math.floor(this.random.range(0, 3));
        return this.random.next() < 0.3 ? 1 : 0;
    }

    private generateMoon(planet: PlanetData, index: number): MoonData {
        return {
            id: `${planet.id}_moon_${index}`,
            name: `${planet.name} ${String.fromCharCode(97 + index)}`, // a, b, c...
            planetId: planet.id,
            orbitDistance: this.random.range(3, 20), // Planet radii
            orbitPeriod: this.random.range(12, 168), // Hours
            radius: this.random.range(0.1, 0.5), // Earth radii
            mass: this.random.range(0.01, 0.2), // Earth masses
            type: this.random.choice(['rocky', 'icy', 'captured_asteroid']),
            tidallyLocked: this.random.next() < 0.8
        };
    }

    private generateAnomalies(): void {
        // Generate special objects and anomalies
        // This will be implemented based on specific game requirements
    }

    private numberToRoman(num: number): string {
        const values = [10, 9, 5, 4, 1];
        const symbols = ['X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        
        for (let i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                result += symbols[i];
                num -= values[i];
            }
        }
        return result;
    }

    /**
     * Public API methods
     */
    getStarsInRadius(center: Vector2, radius: number): StarData[] {
        return this.galaxyMap.filter(star => {
            const distance = Math.sqrt(
                Math.pow(star.position.x - center.x, 2) + 
                Math.pow(star.position.y - center.y, 2)
            );
            return distance <= radius;
        });
    }

    getStarSystem(starId: string): StarSystemData | undefined {
        return this.starSystems.get(starId);
    }

    getAllStars(): StarData[] {
        return [...this.galaxyMap];
    }

    getAllSystems(): StarSystemData[] {
        return Array.from(this.starSystems.values());
    }

    getGalaxyConfig(): GalaxyConfig {
        return { ...this.config };
    }
}

/**
 * Seeded random number generator for consistent generation
 */
class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    choice<T>(array: T[]): T {
        return array[Math.floor(this.next() * array.length)];
    }

    integer(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }
}