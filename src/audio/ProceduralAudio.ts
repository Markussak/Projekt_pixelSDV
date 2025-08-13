/**
 * Procedural Audio System
 * Advanced Web Audio API synthesis for retro 16-bit space game sounds
 */

import { Logger } from '@utils/Logger';

export enum SoundType {
    Engine = 'engine',
    Laser = 'laser',
    Explosion = 'explosion',
    Beep = 'beep',
    Warning = 'warning',
    Warp = 'warp',
    Shield = 'shield',
    Impact = 'impact',
    Communication = 'communication',
    Ambient = 'ambient',
    UI = 'ui',
    Thrust = 'thrust'
}

export enum WaveformType {
    Sine = 'sine',
    Square = 'square',
    Sawtooth = 'sawtooth',
    Triangle = 'triangle',
    Noise = 'white'
}

export interface SoundConfig {
    type: SoundType;
    frequency: number;
    duration: number;
    volume: number;
    
    // Waveform settings
    waveform: WaveformType;
    harmonics?: number[];
    
    // Envelope (ADSR)
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    
    // Modulation
    frequencyModulation?: {
        rate: number;
        depth: number;
        waveform: WaveformType;
    };
    
    // Filter
    filter?: {
        type: 'lowpass' | 'highpass' | 'bandpass';
        frequency: number;
        resonance: number;
    };
    
    // Effects
    distortion?: number;
    reverb?: {
        roomSize: number;
        dampening: number;
        wetness: number;
    };
    
    // Spatial audio
    position?: { x: number, y: number, z: number };
    maxDistance?: number;
}

export interface AmbientTrackConfig {
    name: string;
    layers: AmbientLayer[];
    fadeInTime: number;
    fadeOutTime: number;
    crossfadeTime: number;
}

export interface AmbientLayer {
    id: string;
    waveform: WaveformType;
    baseFrequency: number;
    volume: number;
    pan: number; // -1 to 1
    
    // Modulation
    frequencyVariation: number;
    volumeVariation: number;
    
    // Movement
    frequency: {
        min: number;
        max: number;
        speed: number; // Hz per second
    };
    
    // Filter sweep
    filter?: {
        type: 'lowpass' | 'highpass' | 'bandpass';
        minFreq: number;
        maxFreq: number;
        speed: number;
        resonance: number;
    };
}

export interface AudioEvents {
    onSoundPlayed?: (type: SoundType, config: SoundConfig) => void;
    onTrackChanged?: (trackName: string) => void;
    onAudioError?: (error: Error) => void;
}

export class ProceduralAudio {
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private soundEffectsGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    
    // Ambient music system
    private currentTrack: string | null = null;
    private ambientLayers: Map<string, {
        oscillator: AudioScheduledSourceNode;
        gain: GainNode;
        filter?: BiquadFilterNode;
        panner: StereoPannerNode;
    }> = new Map();
    
    // Sound effect pools
    private activeSounds: Set<AudioNode> = new Set();
    
    // Noise buffer for effects
    private noiseBuffer: AudioBuffer | null = null;
    
    // Reverb
    private convolver: ConvolverNode | null = null;
    private reverbBuffer: AudioBuffer | null = null;
    
    // Master settings
    private masterVolume: number = 0.7;
    private musicVolume: number = 0.5;
    private sfxVolume: number = 0.8;
    
    private events: AudioEvents;
    private logger: Logger;

    constructor(events: AudioEvents = {}) {
        this.logger = new Logger('ProceduralAudio');
        this.events = events;
    }

    /**
     * Initialize audio system
     */
    async initialize(): Promise<void> {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Create master gain nodes
            this.masterGain = this.audioContext.createGain();
            this.soundEffectsGain = this.audioContext.createGain();
            this.musicGain = this.audioContext.createGain();
            
            // Connect audio graph
            this.soundEffectsGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);
            
            // Set initial volumes
            this.masterGain.gain.value = this.masterVolume;
            this.soundEffectsGain.gain.value = this.sfxVolume;
            this.musicGain.gain.value = this.musicVolume;
            
            // Create noise buffer
            await this.createNoiseBuffer();
            
            // Create reverb
            await this.createReverbBuffer();
            
            this.logger.info('🔊 Procedural audio system initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize audio system', error);
            this.events.onAudioError?.(error as Error);
        }
    }

    /**
     * Create white noise buffer
     */
    private async createNoiseBuffer(): Promise<void> {
        if (!this.audioContext) return;
        
        const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds
        this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    /**
     * Create reverb impulse response
     */
    private async createReverbBuffer(): Promise<void> {
        if (!this.audioContext) return;
        
        const length = this.audioContext.sampleRate * 3; // 3 seconds
        this.reverbBuffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = this.reverbBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        
        this.convolver = this.audioContext.createConvolver();
        this.convolver.buffer = this.reverbBuffer;
    }

    /**
     * Play procedural sound effect
     */
    playSound(config: SoundConfig): void {
        if (!this.audioContext || !this.soundEffectsGain) {
            this.logger.warn('Audio system not initialized');
            return;
        }
        
        try {
            const now = this.audioContext.currentTime;
            let source: AudioScheduledSourceNode;
            let sourceGain: GainNode;
            
            // Create source based on waveform
            if (config.waveform === WaveformType.Noise) {
                source = this.createNoiseSource();
            } else {
                source = this.createOscillatorSource(config);
            }
            
            // Create gain for this sound
            sourceGain = this.audioContext.createGain();
            sourceGain.gain.value = 0;
            
            // Create filter if specified
            let filterNode: BiquadFilterNode | undefined;
            if (config.filter) {
                filterNode = this.audioContext.createBiquadFilter();
                filterNode.type = config.filter.type;
                filterNode.frequency.value = config.filter.frequency;
                filterNode.Q.value = config.filter.resonance;
            }
            
            // Create distortion if specified
            let distortionNode: WaveShaperNode | undefined;
            if (config.distortion && config.distortion > 0) {
                distortionNode = this.createDistortion(config.distortion);
            }
            
            // Create spatial panner if position specified
            let pannerNode: PannerNode | undefined;
            if (config.position) {
                pannerNode = this.audioContext.createPanner();
                pannerNode.panningModel = 'HRTF';
                pannerNode.positionX.value = config.position.x;
                pannerNode.positionY.value = config.position.y;
                pannerNode.positionZ.value = config.position.z;
                pannerNode.maxDistance = config.maxDistance || 1000;
            }
            
            // Connect audio graph
            let currentNode: AudioNode = source;
            
            if (filterNode) {
                currentNode.connect(filterNode);
                currentNode = filterNode;
            }
            
            if (distortionNode) {
                currentNode.connect(distortionNode);
                currentNode = distortionNode;
            }
            
            currentNode.connect(sourceGain);
            
            if (pannerNode) {
                sourceGain.connect(pannerNode);
                pannerNode.connect(this.soundEffectsGain);
            } else {
                sourceGain.connect(this.soundEffectsGain);
            }
            
            // Apply ADSR envelope
            this.applyEnvelope(sourceGain.gain, config, now);
            
            // Apply frequency modulation if specified
            if (config.frequencyModulation && source instanceof OscillatorNode) {
                this.applyFrequencyModulation(source, config.frequencyModulation, now);
            }
            
            // Start and schedule stop
            source.start(now);
            source.stop(now + config.duration);
            
            // Track active sound
            this.activeSounds.add(source);
            source.addEventListener('ended', () => {
                this.activeSounds.delete(source);
            });
            
            this.events.onSoundPlayed?.(config.type, config);
            
        } catch (error) {
            this.logger.error('Failed to play sound', error);
        }
    }

    /**
     * Create oscillator source
     */
    private createOscillatorSource(config: SoundConfig): OscillatorNode {
        const oscillator = this.audioContext!.createOscillator();
        oscillator.type = config.waveform as OscillatorType;
        oscillator.frequency.value = config.frequency;
        
        // Add harmonics for richer sound
        if (config.harmonics) {
            // Create additional oscillators for harmonics
            config.harmonics.forEach((harmonic, index) => {
                if (harmonic > 0) {
                    const harmonicOsc = this.audioContext!.createOscillator();
                    const harmonicGain = this.audioContext!.createGain();
                    
                    harmonicOsc.type = config.waveform as OscillatorType;
                    harmonicOsc.frequency.value = config.frequency * (index + 2);
                    harmonicGain.gain.value = harmonic;
                    
                    harmonicOsc.connect(harmonicGain);
                    // Note: This simplified version connects to the same destination
                    // In practice, you'd want to manage these connections properly
                }
            });
        }
        
        return oscillator;
    }

    /**
     * Create noise source
     */
    private createNoiseSource(): AudioBufferSourceNode {
        const source = this.audioContext!.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        return source;
    }

    /**
     * Create distortion effect
     */
    private createDistortion(amount: number): WaveShaperNode {
        const distortion = this.audioContext!.createWaveShaper();
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        
        distortion.curve = curve;
        distortion.oversample = '4x';
        
        return distortion;
    }

    /**
     * Apply ADSR envelope
     */
    private applyEnvelope(gainParam: AudioParam, config: SoundConfig, startTime: number): void {
        const { attack, decay, sustain, release, volume, duration } = config;
        
        // Attack
        gainParam.setValueAtTime(0, startTime);
        gainParam.linearRampToValueAtTime(volume, startTime + attack);
        
        // Decay
        gainParam.linearRampToValueAtTime(volume * sustain, startTime + attack + decay);
        
        // Sustain (hold until release)
        const sustainEnd = Math.max(startTime + attack + decay, startTime + duration - release);
        gainParam.setValueAtTime(volume * sustain, sustainEnd);
        
        // Release
        gainParam.linearRampToValueAtTime(0, startTime + duration);
    }

    /**
     * Apply frequency modulation
     */
    private applyFrequencyModulation(
        oscillator: OscillatorNode, 
        modConfig: NonNullable<SoundConfig['frequencyModulation']>, 
        startTime: number
    ): void {
        const modOscillator = this.audioContext!.createOscillator();
        const modGain = this.audioContext!.createGain();
        
        modOscillator.type = modConfig.waveform as OscillatorType;
        modOscillator.frequency.value = modConfig.rate;
        modGain.gain.value = modConfig.depth;
        
        modOscillator.connect(modGain);
        modGain.connect(oscillator.frequency);
        
        modOscillator.start(startTime);
        modOscillator.stop(startTime + 10); // Long enough for any sound
    }

    /**
     * Play retro-style sound effects
     */
    playRetroSound(type: SoundType, intensity: number = 1.0): void {
        const configs: { [key in SoundType]: SoundConfig } = {
            [SoundType.Engine]: {
                type: SoundType.Engine,
                frequency: 60 + intensity * 40,
                duration: 0.5,
                volume: 0.3 * intensity,
                waveform: WaveformType.Sawtooth,
                attack: 0.1,
                decay: 0.1,
                sustain: 0.7,
                release: 0.3,
                filter: {
                    type: 'lowpass',
                    frequency: 800 + intensity * 400,
                    resonance: 2
                }
            },
            [SoundType.Laser]: {
                type: SoundType.Laser,
                frequency: 800,
                duration: 0.15,
                volume: 0.4 * intensity,
                waveform: WaveformType.Square,
                attack: 0.01,
                decay: 0.05,
                sustain: 0.3,
                release: 0.09,
                frequencyModulation: {
                    rate: 30,
                    depth: 200,
                    waveform: WaveformType.Sine
                }
            },
            [SoundType.Explosion]: {
                type: SoundType.Explosion,
                frequency: 120,
                duration: 0.8,
                volume: 0.6 * intensity,
                waveform: WaveformType.Noise,
                attack: 0.01,
                decay: 0.3,
                sustain: 0.2,
                release: 0.49,
                filter: {
                    type: 'lowpass',
                    frequency: 2000 - intensity * 500,
                    resonance: 1
                },
                distortion: 0.5
            },
            [SoundType.Beep]: {
                type: SoundType.Beep,
                frequency: 1000,
                duration: 0.1,
                volume: 0.3 * intensity,
                waveform: WaveformType.Square,
                attack: 0.01,
                decay: 0.02,
                sustain: 0.8,
                release: 0.07
            },
            [SoundType.Warning]: {
                type: SoundType.Warning,
                frequency: 800,
                duration: 0.5,
                volume: 0.5 * intensity,
                waveform: WaveformType.Square,
                attack: 0.05,
                decay: 0.1,
                sustain: 0.6,
                release: 0.35,
                frequencyModulation: {
                    rate: 8,
                    depth: 100,
                    waveform: WaveformType.Triangle
                }
            },
            [SoundType.Warp]: {
                type: SoundType.Warp,
                frequency: 200,
                duration: 2.0,
                volume: 0.4 * intensity,
                waveform: WaveformType.Sine,
                attack: 0.5,
                decay: 0.5,
                sustain: 0.8,
                release: 1.0,
                frequencyModulation: {
                    rate: 0.5,
                    depth: 400,
                    waveform: WaveformType.Sine
                },
                reverb: {
                    roomSize: 0.8,
                    dampening: 0.3,
                    wetness: 0.6
                }
            },
            [SoundType.Shield]: {
                type: SoundType.Shield,
                frequency: 400,
                duration: 0.3,
                volume: 0.3 * intensity,
                waveform: WaveformType.Triangle,
                attack: 0.1,
                decay: 0.1,
                sustain: 0.5,
                release: 0.1,
                filter: {
                    type: 'bandpass',
                    frequency: 600,
                    resonance: 5
                }
            },
            [SoundType.Impact]: {
                type: SoundType.Impact,
                frequency: 80,
                duration: 0.2,
                volume: 0.5 * intensity,
                waveform: WaveformType.Noise,
                attack: 0.01,
                decay: 0.05,
                sustain: 0.3,
                release: 0.14,
                filter: {
                    type: 'lowpass',
                    frequency: 500,
                    resonance: 2
                },
                distortion: 0.3
            },
            [SoundType.Communication]: {
                type: SoundType.Communication,
                frequency: 1200,
                duration: 0.4,
                volume: 0.25 * intensity,
                waveform: WaveformType.Sine,
                attack: 0.1,
                decay: 0.1,
                sustain: 0.6,
                release: 0.2,
                frequencyModulation: {
                    rate: 5,
                    depth: 50,
                    waveform: WaveformType.Triangle
                }
            },
            [SoundType.Ambient]: {
                type: SoundType.Ambient,
                frequency: 200,
                duration: 5.0,
                volume: 0.2 * intensity,
                waveform: WaveformType.Sine,
                attack: 2.0,
                decay: 1.0,
                sustain: 0.8,
                release: 2.0
            },
            [SoundType.UI]: {
                type: SoundType.UI,
                frequency: 600,
                duration: 0.08,
                volume: 0.2 * intensity,
                waveform: WaveformType.Square,
                attack: 0.01,
                decay: 0.02,
                sustain: 0.5,
                release: 0.05
            },
            [SoundType.Thrust]: {
                type: SoundType.Thrust,
                frequency: 100 + intensity * 50,
                duration: 0.3,
                volume: 0.4 * intensity,
                waveform: WaveformType.Sawtooth,
                attack: 0.05,
                decay: 0.1,
                sustain: 0.8,
                release: 0.15,
                filter: {
                    type: 'lowpass',
                    frequency: 400 + intensity * 200,
                    resonance: 1
                }
            }
        };
        
        this.playSound(configs[type]);
    }

    /**
     * Start ambient space music
     */
    startAmbientTrack(trackName: string): void {
        if (this.currentTrack === trackName) return;
        
        this.stopAmbientTrack();
        
        const trackConfigs: { [key: string]: AmbientTrackConfig } = {
            'deep_space': {
                name: 'Deep Space',
                fadeInTime: 3.0,
                fadeOutTime: 2.0,
                crossfadeTime: 1.0,
                layers: [
                    {
                        id: 'bass_drone',
                        waveform: WaveformType.Sine,
                        baseFrequency: 40,
                        volume: 0.3,
                        pan: 0,
                        frequencyVariation: 0.1,
                        volumeVariation: 0.2,
                        frequency: { min: 35, max: 45, speed: 0.1 },
                        filter: {
                            type: 'lowpass',
                            minFreq: 200,
                            maxFreq: 800,
                            speed: 0.05,
                            resonance: 2
                        }
                    },
                    {
                        id: 'cosmic_wind',
                        waveform: WaveformType.Noise,
                        baseFrequency: 200,
                        volume: 0.15,
                        pan: -0.3,
                        frequencyVariation: 0.3,
                        volumeVariation: 0.4,
                        frequency: { min: 150, max: 300, speed: 0.2 },
                        filter: {
                            type: 'bandpass',
                            minFreq: 800,
                            maxFreq: 3000,
                            speed: 0.3,
                            resonance: 1
                        }
                    },
                    {
                        id: 'stellar_harmonics',
                        waveform: WaveformType.Triangle,
                        baseFrequency: 220,
                        volume: 0.2,
                        pan: 0.4,
                        frequencyVariation: 0.2,
                        volumeVariation: 0.3,
                        frequency: { min: 200, max: 440, speed: 0.15 },
                        filter: {
                            type: 'highpass',
                            minFreq: 400,
                            maxFreq: 1200,
                            speed: 0.1,
                            resonance: 0.5
                        }
                    }
                ]
            },
            'nebula_drift': {
                name: 'Nebula Drift',
                fadeInTime: 4.0,
                fadeOutTime: 3.0,
                crossfadeTime: 2.0,
                layers: [
                    {
                        id: 'nebula_wash',
                        waveform: WaveformType.Sine,
                        baseFrequency: 80,
                        volume: 0.25,
                        pan: 0,
                        frequencyVariation: 0.3,
                        volumeVariation: 0.5,
                        frequency: { min: 60, max: 120, speed: 0.08 },
                        filter: {
                            type: 'lowpass',
                            minFreq: 300,
                            maxFreq: 1500,
                            speed: 0.12,
                            resonance: 3
                        }
                    },
                    {
                        id: 'particle_shimmer',
                        waveform: WaveformType.Triangle,
                        baseFrequency: 800,
                        volume: 0.1,
                        pan: -0.6,
                        frequencyVariation: 0.4,
                        volumeVariation: 0.6,
                        frequency: { min: 600, max: 1200, speed: 0.4 },
                        filter: {
                            type: 'bandpass',
                            minFreq: 1000,
                            maxFreq: 4000,
                            speed: 0.5,
                            resonance: 2
                        }
                    }
                ]
            },
            'void_silence': {
                name: 'Void Silence',
                fadeInTime: 5.0,
                fadeOutTime: 4.0,
                crossfadeTime: 3.0,
                layers: [
                    {
                        id: 'quantum_whisper',
                        waveform: WaveformType.Sine,
                        baseFrequency: 30,
                        volume: 0.15,
                        pan: 0,
                        frequencyVariation: 0.05,
                        volumeVariation: 0.8,
                        frequency: { min: 25, max: 35, speed: 0.02 },
                        filter: {
                            type: 'lowpass',
                            minFreq: 100,
                            maxFreq: 400,
                            speed: 0.03,
                            resonance: 1
                        }
                    }
                ]
            }
        };
        
        const config = trackConfigs[trackName];
        if (!config) {
            this.logger.warn(`Unknown ambient track: ${trackName}`);
            return;
        }
        
        this.currentTrack = trackName;
        this.createAmbientLayers(config);
        
        this.events.onTrackChanged?.(trackName);
        this.logger.info(`🎵 Started ambient track: ${trackName}`);
    }

    /**
     * Create ambient music layers
     */
    private createAmbientLayers(config: AmbientTrackConfig): void {
        if (!this.audioContext || !this.musicGain) return;
        
        const now = this.audioContext.currentTime;
        
        config.layers.forEach(layerConfig => {
            let source: AudioScheduledSourceNode;
            
            if (layerConfig.waveform === WaveformType.Noise) {
                source = this.audioContext!.createBufferSource();
                (source as AudioBufferSourceNode).buffer = this.noiseBuffer;
                (source as AudioBufferSourceNode).loop = true;
            } else {
                const oscillator = this.audioContext!.createOscillator();
                oscillator.type = layerConfig.waveform as OscillatorType;
                oscillator.frequency.value = layerConfig.baseFrequency;
                source = oscillator;
            }
            
            // Create gain for this layer
            const layerGain = this.audioContext!.createGain();
            layerGain.gain.value = 0;
            
            // Create panner
            const panner = this.audioContext!.createStereoPanner();
            panner.pan.value = layerConfig.pan;
            
            // Create filter if specified
            let filter: BiquadFilterNode | undefined;
            if (layerConfig.filter) {
                filter = this.audioContext!.createBiquadFilter();
                filter.type = layerConfig.filter.type;
                filter.frequency.value = layerConfig.filter.minFreq;
                filter.Q.value = layerConfig.filter.resonance;
            }
            
            // Connect audio graph
            let currentNode: AudioNode = source;
            
            if (filter) {
                currentNode.connect(filter);
                currentNode = filter;
            }
            
            currentNode.connect(layerGain);
            layerGain.connect(panner);
            panner.connect(this.musicGain!);
            
            // Fade in
            layerGain.gain.linearRampToValueAtTime(
                layerConfig.volume, 
                now + config.fadeInTime
            );
            
            // Start the source
            source.start(now);
            
            // Store layer references
            this.ambientLayers.set(layerConfig.id, {
                oscillator: source,
                gain: layerGain,
                filter,
                panner
            });
            
            // Start modulation if oscillator
            if (source instanceof OscillatorNode) {
                this.startLayerModulation(source, layerConfig, filter);
            }
        });
    }

    /**
     * Start layer modulation effects
     */
    private startLayerModulation(
        oscillator: OscillatorNode, 
        config: AmbientLayer, 
        filter?: BiquadFilterNode
    ): void {
        if (!this.audioContext) return;
        
        // Frequency modulation
        const freqModOsc = this.audioContext.createOscillator();
        const freqModGain = this.audioContext.createGain();
        
        freqModOsc.type = 'sine';
        freqModOsc.frequency.value = config.frequency.speed;
        freqModGain.gain.value = (config.frequency.max - config.frequency.min) / 2;
        
        freqModOsc.connect(freqModGain);
        freqModGain.connect(oscillator.frequency);
        freqModOsc.start();
        
        // Filter modulation
        if (filter && config.filter) {
            const filterModOsc = this.audioContext.createOscillator();
            const filterModGain = this.audioContext.createGain();
            
            filterModOsc.type = 'triangle';
            filterModOsc.frequency.value = config.filter.speed;
            filterModGain.gain.value = (config.filter.maxFreq - config.filter.minFreq) / 2;
            
            filterModOsc.connect(filterModGain);
            filterModGain.connect(filter.frequency);
            filterModOsc.start();
        }
    }

    /**
     * Stop ambient track
     */
    stopAmbientTrack(): void {
        if (!this.currentTrack || !this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        const fadeTime = 2.0;
        
        // Fade out all layers
        this.ambientLayers.forEach(layer => {
            layer.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
            layer.oscillator.stop(now + fadeTime + 0.1);
        });
        
        // Clear layers after fade
        setTimeout(() => {
            this.ambientLayers.clear();
        }, (fadeTime + 0.2) * 1000);
        
        this.currentTrack = null;
        this.logger.info('🎵 Stopped ambient track');
    }

    /**
     * Set master volume
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.masterVolume;
        }
    }

    /**
     * Set music volume
     */
    setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.musicVolume;
        }
    }

    /**
     * Set sound effects volume
     */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.soundEffectsGain) {
            this.soundEffectsGain.gain.value = this.sfxVolume;
        }
    }

    /**
     * Get audio statistics
     */
    getAudioStats(): {
        contextState: string;
        activeSounds: number;
        currentTrack: string | null;
        ambientLayers: number;
        masterVolume: number;
        musicVolume: number;
        sfxVolume: number;
    } {
        return {
            contextState: this.audioContext?.state || 'not_initialized',
            activeSounds: this.activeSounds.size,
            currentTrack: this.currentTrack,
            ambientLayers: this.ambientLayers.size,
            masterVolume: this.masterVolume,
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume
        };
    }

    /**
     * Stop all sounds
     */
    stopAllSounds(): void {
        // Stop sound effects
        this.activeSounds.forEach(sound => {
            if (sound instanceof AudioScheduledSourceNode) {
                try {
                    sound.stop();
                } catch (e) {
                    // Sound might already be stopped
                }
            }
        });
        this.activeSounds.clear();
        
        // Stop ambient music
        this.stopAmbientTrack();
    }

    /**
     * Dispose audio system
     */
    dispose(): void {
        this.stopAllSounds();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.logger.info('🔊 Audio system disposed');
    }
}