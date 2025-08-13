/**
 * Web Audio API-based Audio Engine
 * Handles procedural sound synthesis and 16-bit style audio effects
 */

import { Platform } from '@utils/Platform';
import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';

export interface AudioConfig {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    enableSpatialAudio: boolean;
    maxChannels: number;
    sampleRate: number;
}

export interface SoundEffect {
    id: string;
    buffer: AudioBuffer;
    loop: boolean;
    volume: number;
    pitch: number;
    type: 'engine' | 'weapon' | 'ambient' | 'ui' | 'explosion';
}

export interface AudioSource {
    id: string;
    node: AudioBufferSourceNode | OscillatorNode;
    gainNode: GainNode;
    pannerNode?: PannerNode;
    position?: Vector2;
    isPlaying: boolean;
    loop: boolean;
    startTime: number;
}

export class AudioEngine {
    private context: AudioContext | null = null;
    private platform: Platform;
    private config: AudioConfig;
    
    // Audio nodes
    private masterGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private sfxGain: GainNode | null = null;
    
    // Sound management
    private soundEffects: Map<string, SoundEffect> = new Map();
    private activeSources: Map<string, AudioSource> = new Map();
    
    // Music system
    private musicTrack: AudioSource | null = null;
    private ambientTrack: AudioSource | null = null;
    
    // 16-bit synthesis
    private synthNodes: Map<string, OscillatorNode> = new Map();
    
    private logger: Logger;
    private isInitialized = false;

    constructor(platform: Platform) {
        this.platform = platform;
        this.logger = new Logger('AudioEngine');
        
        // Configure audio based on platform
        this.config = {
            masterVolume: 1.0,
            musicVolume: 0.7,
            sfxVolume: 0.8,
            enableSpatialAudio: platform === Platform.Desktop,
            maxChannels: platform === Platform.Mobile ? 8 : 16,
            sampleRate: 44100
        };
        
        this.logger.info('🔊 Audio engine created', {
            platform: platform,
            config: this.config
        });
    }

    /**
     * Initialize the audio engine
     */
    async initialize(): Promise<void> {
        this.logger.info('🔧 Initializing audio engine...');
        
        try {
            // Create audio context
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: this.config.sampleRate
            });
            
            // Handle context state
            if (this.context.state === 'suspended') {
                this.logger.info('Audio context suspended, will resume on user interaction');
                this.setupUserInteractionHandler();
            }
            
            // Create master gain nodes
            this.masterGain = this.context.createGain();
            this.musicGain = this.context.createGain();
            this.sfxGain = this.context.createGain();
            
            // Connect gain nodes
            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.context.destination);
            
            // Set initial volumes
            this.setMasterVolume(this.config.masterVolume);
            this.setMusicVolume(this.config.musicVolume);
            this.setSfxVolume(this.config.sfxVolume);
            
            // Generate basic sound effects
            await this.generateBasicSounds();
            
            this.isInitialized = true;
            this.logger.info('✅ Audio engine initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Audio engine initialization failed', error);
            throw error;
        }
    }

    /**
     * Setup user interaction handler for audio context
     */
    private setupUserInteractionHandler(): void {
        const resumeAudio = async () => {
            if (this.context && this.context.state === 'suspended') {
                await this.context.resume();
                this.logger.info('Audio context resumed');
                
                // Remove event listeners
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('keydown', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            }
        };
        
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('keydown', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });
    }

    /**
     * Generate basic 16-bit style sound effects
     */
    private async generateBasicSounds(): Promise<void> {
        if (!this.context) return;
        
        // Engine thrust sound
        const engineBuffer = this.generateEngineSound(1.0);
        this.soundEffects.set('engine_thrust', {
            id: 'engine_thrust',
            buffer: engineBuffer,
            loop: true,
            volume: 0.6,
            pitch: 1.0,
            type: 'engine'
        });
        
        // Laser weapon sound
        const laserBuffer = this.generateLaserSound();
        this.soundEffects.set('weapon_laser', {
            id: 'weapon_laser',
            buffer: laserBuffer,
            loop: false,
            volume: 0.8,
            pitch: 1.0,
            type: 'weapon'
        });
        
        // Explosion sound
        const explosionBuffer = this.generateExplosionSound();
        this.soundEffects.set('explosion', {
            id: 'explosion',
            buffer: explosionBuffer,
            loop: false,
            volume: 1.0,
            pitch: 1.0,
            type: 'explosion'
        });
        
        // UI beep sound
        const beepBuffer = this.generateBeepSound(800, 0.1);
        this.soundEffects.set('ui_beep', {
            id: 'ui_beep',
            buffer: beepBuffer,
            loop: false,
            volume: 0.5,
            pitch: 1.0,
            type: 'ui'
        });
        
        this.logger.debug('Generated basic sound effects');
    }

    /**
     * Generate procedural engine sound
     */
    private generateEngineSound(duration: number): AudioBuffer {
        if (!this.context) throw new Error('Audio context not initialized');
        
        const sampleRate = this.context.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const buffer = this.context.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            
            // Multiple oscillators for rich engine sound
            const baseFreq = 60 + Math.sin(t * 5) * 10; // Low rumble with variation
            const harmonic1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.5;
            const harmonic2 = Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.3;
            const harmonic3 = Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.2;
            
            // Add noise for texture
            const noise = (Math.random() - 0.5) * 0.1;
            
            data[i] = (harmonic1 + harmonic2 + harmonic3 + noise) * 0.3;
        }
        
        return buffer;
    }

    /**
     * Generate procedural laser sound
     */
    private generateLaserSound(): AudioBuffer {
        if (!this.context) throw new Error('Audio context not initialized');
        
        const duration = 0.2;
        const sampleRate = this.context.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const buffer = this.context.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const progress = t / duration;
            
            // Frequency sweep from high to low
            const freq = 1200 - progress * 800;
            const amplitude = Math.exp(-progress * 8); // Exponential decay
            
            data[i] = Math.sin(2 * Math.PI * freq * t) * amplitude * 0.5;
        }
        
        return buffer;
    }

    /**
     * Generate procedural explosion sound
     */
    private generateExplosionSound(): AudioBuffer {
        if (!this.context) throw new Error('Audio context not initialized');
        
        const duration = 1.0;
        const sampleRate = this.context.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const buffer = this.context.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const progress = t / duration;
            
            // Start with sharp attack, then decay
            const amplitude = progress < 0.1 ? 
                progress * 10 : // Quick attack
                Math.exp(-(progress - 0.1) * 5); // Exponential decay
            
            // Mix of noise and low frequency rumble
            const noise = (Math.random() - 0.5) * 2;
            const rumble = Math.sin(2 * Math.PI * 40 * t) * 0.5;
            
            data[i] = (noise * 0.7 + rumble * 0.3) * amplitude * 0.6;
        }
        
        return buffer;
    }

    /**
     * Generate simple beep sound
     */
    private generateBeepSound(frequency: number, duration: number): AudioBuffer {
        if (!this.context) throw new Error('Audio context not initialized');
        
        const sampleRate = this.context.sampleRate;
        const samples = Math.floor(sampleRate * duration);
        const buffer = this.context.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const amplitude = Math.exp(-t * 10); // Quick decay
            
            data[i] = Math.sin(2 * Math.PI * frequency * t) * amplitude * 0.4;
        }
        
        return buffer;
    }

    /**
     * Play a sound effect
     */
    playSfx(soundId: string, position?: Vector2, pitch: number = 1.0, volume: number = 1.0): string | null {
        if (!this.isInitialized || !this.context) {
            this.logger.warn('Audio engine not initialized, cannot play sound');
            return null;
        }
        
        const soundEffect = this.soundEffects.get(soundId);
        if (!soundEffect) {
            this.logger.warn(`Sound effect not found: ${soundId}`);
            return null;
        }
        
        try {
            // Create audio source
            const source = this.context.createBufferSource();
            const gainNode = this.context.createGain();
            const sourceId = `${soundId}_${Date.now()}_${Math.random()}`;
            
            // Setup source
            source.buffer = soundEffect.buffer;
            source.loop = soundEffect.loop;
            source.playbackRate.value = pitch;
            
            // Setup gain
            gainNode.gain.value = soundEffect.volume * volume;
            
            // Connect nodes
            source.connect(gainNode);
            
            // Add spatial audio if enabled and position provided
            let pannerNode: PannerNode | undefined;
            if (this.config.enableSpatialAudio && position) {
                pannerNode = this.context.createPanner();
                pannerNode.panningModel = 'HRTF';
                pannerNode.distanceModel = 'inverse';
                pannerNode.refDistance = 100;
                pannerNode.maxDistance = 1000;
                pannerNode.rolloffFactor = 1;
                
                // Set position
                pannerNode.positionX.value = position.x;
                pannerNode.positionY.value = position.y;
                pannerNode.positionZ.value = 0;
                
                gainNode.connect(pannerNode);
                pannerNode.connect(this.sfxGain!);
            } else {
                gainNode.connect(this.sfxGain!);
            }
            
            // Track the audio source
            const audioSource: AudioSource = {
                id: sourceId,
                node: source,
                gainNode,
                pannerNode,
                position,
                isPlaying: true,
                loop: soundEffect.loop,
                startTime: this.context.currentTime
            };
            
            this.activeSources.set(sourceId, audioSource);
            
            // Handle sound end
            source.onended = () => {
                this.activeSources.delete(sourceId);
            };
            
            // Start playback
            source.start();
            
            this.logger.debug(`Playing sound: ${soundId} (${sourceId})`);
            return sourceId;
            
        } catch (error) {
            this.logger.error(`Failed to play sound: ${soundId}`, error);
            return null;
        }
    }

    /**
     * Stop a playing sound
     */
    stopSound(sourceId: string): void {
        const audioSource = this.activeSources.get(sourceId);
        if (audioSource && audioSource.isPlaying) {
            try {
                audioSource.node.stop();
                audioSource.isPlaying = false;
                this.activeSources.delete(sourceId);
                this.logger.debug(`Stopped sound: ${sourceId}`);
            } catch (error) {
                this.logger.error(`Failed to stop sound: ${sourceId}`, error);
            }
        }
    }

    /**
     * Update spatial audio positions
     */
    updateSpatialAudio(sourceId: string, position: Vector2): void {
        const audioSource = this.activeSources.get(sourceId);
        if (audioSource && audioSource.pannerNode) {
            audioSource.pannerNode.positionX.value = position.x;
            audioSource.pannerNode.positionY.value = position.y;
            audioSource.position = position;
        }
    }

    /**
     * Set listener position for spatial audio
     */
    setListenerPosition(position: Vector2, orientation: number = 0): void {
        if (!this.context || !this.config.enableSpatialAudio) return;
        
        const listener = this.context.listener;
        if (listener.positionX) {
            listener.positionX.value = position.x;
            listener.positionY.value = position.y;
            listener.positionZ.value = 0;
            
            // Set orientation
            listener.forwardX.value = Math.cos(orientation);
            listener.forwardY.value = Math.sin(orientation);
            listener.forwardZ.value = 0;
            
            listener.upX.value = 0;
            listener.upY.value = 0;
            listener.upZ.value = 1;
        }
    }

    /**
     * Volume controls
     */
    setMasterVolume(volume: number): void {
        this.config.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.config.masterVolume;
        }
    }

    setMusicVolume(volume: number): void {
        this.config.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.musicGain) {
            this.musicGain.gain.value = this.config.musicVolume;
        }
    }

    setSfxVolume(volume: number): void {
        this.config.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.sfxGain) {
            this.sfxGain.gain.value = this.config.sfxVolume;
        }
    }

    /**
     * Game-specific audio methods
     */
    playEngineSound(): string | null {
        return this.playSfx('engine_thrust', undefined, 1.0, 0.6);
    }

    playLaserSound(position?: Vector2): string | null {
        return this.playSfx('weapon_laser', position, 1.0 + (Math.random() - 0.5) * 0.2);
    }

    playExplosion(position?: Vector2): string | null {
        return this.playSfx('explosion', position, 1.0, 0.8);
    }

    playUIBeep(): string | null {
        return this.playSfx('ui_beep');
    }

    /**
     * Update audio engine (called each frame)
     */
    update(deltaTime: number): void {
        // Clean up finished sounds
        for (const [id, source] of this.activeSources) {
            if (!source.isPlaying && !source.loop) {
                this.activeSources.delete(id);
            }
        }
    }

    /**
     * Pause all audio
     */
    pauseAll(): void {
        if (this.context && this.context.state === 'running') {
            this.context.suspend();
            this.logger.debug('Audio paused');
        }
    }

    /**
     * Resume all audio
     */
    resumeAll(): void {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
            this.logger.debug('Audio resumed');
        }
    }

    /**
     * Stop all audio
     */
    stopAll(): void {
        for (const [id, source] of this.activeSources) {
            if (source.isPlaying) {
                try {
                    source.node.stop();
                } catch (error) {
                    // Ignore errors when stopping
                }
            }
        }
        this.activeSources.clear();
        this.logger.debug('All audio stopped');
    }

    /**
     * Get audio statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            contextState: this.context?.state || 'none',
            activeSources: this.activeSources.size,
            soundEffects: this.soundEffects.size,
            config: { ...this.config }
        };
    }

    /**
     * Cleanup audio resources
     */
    cleanup(): void {
        this.stopAll();
        
        if (this.context) {
            this.context.close();
        }
        
        this.soundEffects.clear();
        this.synthNodes.clear();
        
        this.logger.info('🧹 Audio engine cleanup completed');
    }
}