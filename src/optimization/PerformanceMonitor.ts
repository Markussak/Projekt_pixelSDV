/**
 * Performance Monitor
 * Advanced system for tracking game performance and optimization
 */

import { Logger } from '@utils/Logger';
import { Platform, PlatformDetector } from '@utils/Platform';

export interface PerformanceMetrics {
    // Frame timing
    fps: number;
    frameTime: number; // milliseconds
    deltaTime: number;
    
    // Memory usage
    memoryUsed: number; // MB
    memoryTotal: number; // MB
    memoryPercentage: number;
    
    // Rendering
    drawCalls: number;
    triangles: number;
    
    // System
    cpuUsage: number; // Estimated
    batteryLevel?: number;
    thermalState?: 'normal' | 'fair' | 'serious' | 'critical';
    
    // Network
    latency?: number;
    bandwidth?: number;
    
    // Game specific
    activeEntities: number;
    activeSounds: number;
    textureMemory: number;
    
    timestamp: number;
}

export interface PerformanceThresholds {
    fps: {
        excellent: number;
        good: number;
        acceptable: number;
        poor: number;
    };
    memory: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    frameTime: {
        target: number;
        warning: number;
        critical: number;
    };
}

export interface PerformanceSettings {
    // Rendering quality
    renderScale: number; // 0.5 - 2.0
    particleQuality: 'low' | 'medium' | 'high';
    shadowQuality: 'off' | 'low' | 'medium' | 'high';
    
    // Effects
    postProcessing: boolean;
    bloom: boolean;
    antiAliasing: boolean;
    
    // LOD settings
    lodBias: number;
    maxRenderDistance: number;
    
    // Audio
    audioQuality: 'low' | 'medium' | 'high';
    maxAudioSources: number;
    
    // Physics
    physicsSteps: number;
    collisionComplexity: 'simple' | 'medium' | 'complex';
    
    // Platform specific
    mobileLowPowerMode: boolean;
    vsync: boolean;
    
    // Auto-optimization
    autoOptimize: boolean;
    adaptiveQuality: boolean;
}

export interface OptimizationRecommendation {
    category: 'rendering' | 'memory' | 'audio' | 'physics' | 'general';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    settings: Partial<PerformanceSettings>;
    automaticApply: boolean;
}

export interface PerformanceEvents {
    onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
    onThresholdExceeded?: (metric: string, value: number, threshold: number) => void;
    onOptimizationRecommended?: (recommendations: OptimizationRecommendation[]) => void;
    onSettingsChanged?: (settings: PerformanceSettings) => void;
}

export class PerformanceMonitor {
    // Metrics tracking
    private metrics: PerformanceMetrics[] = [];
    private currentMetrics: PerformanceMetrics;
    private maxHistory: number = 300; // 5 minutes at 60fps
    
    // Timing
    private frameStartTime: number = 0;
    private lastFrameTime: number = 0;
    private fpsHistory: number[] = [];
    private fpsCounter: number = 0;
    private fpsTimer: number = 0;
    
    // Memory tracking
    private memoryObserver: PerformanceObserver | null = null;
    
    // Performance thresholds
    private thresholds: PerformanceThresholds;
    
    // Current settings
    private settings: PerformanceSettings;
    
    // Platform info
    private platform: Platform;
    
    // Optimization
    private lastOptimizationCheck: number = 0;
    private optimizationInterval: number = 10000; // 10 seconds
    
    private events: PerformanceEvents;
    private logger: Logger;

    constructor(events: PerformanceEvents = {}) {
        this.logger = new Logger('PerformanceMonitor');
        this.events = events;
        this.platform = PlatformDetector.detect();
        
        // Initialize default thresholds
        this.thresholds = this.getDefaultThresholds();
        
        // Initialize default settings based on platform
        this.settings = this.getDefaultSettings();
        
        // Initialize current metrics
        this.currentMetrics = this.createEmptyMetrics();
        
        this.logger.info('📊 Performance monitor initialized');
    }

    /**
     * Initialize performance monitoring
     */
    initialize(): void {
        this.setupMemoryObserver();
        this.startMonitoring();
        
        // Auto-optimization if enabled
        if (this.settings.autoOptimize) {
            this.enableAutoOptimization();
        }
        
        this.logger.info('📊 Performance monitoring started');
    }

    /**
     * Setup memory observer
     */
    private setupMemoryObserver(): void {
        if ('PerformanceObserver' in window) {
            try {
                this.memoryObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'measure') {
                            // Process memory measurements
                        }
                    }
                });
                
                this.memoryObserver.observe({ entryTypes: ['measure'] });
            } catch (error) {
                this.logger.warn('Failed to setup memory observer', error);
            }
        }
    }

    /**
     * Start performance monitoring
     */
    private startMonitoring(): void {
        // Setup frame timing
        this.frameStartTime = performance.now();
        this.lastFrameTime = this.frameStartTime;
    }

    /**
     * Update performance metrics
     */
    update(deltaTime: number): void {
        const now = performance.now();
        
        // Update frame timing
        this.updateFrameTiming(now, deltaTime);
        
        // Update memory usage
        this.updateMemoryUsage();
        
        // Update system metrics
        this.updateSystemMetrics();
        
        // Update current metrics
        this.updateCurrentMetrics(now);
        
        // Store metrics history
        this.storeMetrics();
        
        // Check thresholds
        this.checkThresholds();
        
        // Auto-optimization check
        if (this.settings.autoOptimize && now - this.lastOptimizationCheck > this.optimizationInterval) {
            this.performOptimizationCheck();
            this.lastOptimizationCheck = now;
        }
        
        // Emit performance update
        this.events.onPerformanceUpdate?.(this.currentMetrics);
    }

    /**
     * Update frame timing metrics
     */
    private updateFrameTiming(now: number, deltaTime: number): void {
        const frameTime = now - this.frameStartTime;
        this.frameStartTime = now;
        
        // Update FPS
        this.fpsCounter++;
        this.fpsTimer += deltaTime;
        
        if (this.fpsTimer >= 1000) { // Update every second
            const fps = this.fpsCounter / (this.fpsTimer / 1000);
            this.fpsHistory.push(fps);
            
            if (this.fpsHistory.length > 60) { // Keep 60 seconds
                this.fpsHistory.shift();
            }
            
            this.fpsCounter = 0;
            this.fpsTimer = 0;
        }
        
        this.currentMetrics.frameTime = frameTime;
        this.currentMetrics.deltaTime = deltaTime;
        this.currentMetrics.fps = this.getAverageFPS();
    }

    /**
     * Update memory usage
     */
    private updateMemoryUsage(): void {
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            
            this.currentMetrics.memoryUsed = memory.usedJSHeapSize / 1024 / 1024; // MB
            this.currentMetrics.memoryTotal = memory.totalJSHeapSize / 1024 / 1024; // MB
            this.currentMetrics.memoryPercentage = (this.currentMetrics.memoryUsed / this.currentMetrics.memoryTotal) * 100;
        } else {
            // Estimate memory usage
            this.currentMetrics.memoryUsed = this.estimateMemoryUsage();
            this.currentMetrics.memoryTotal = this.estimateTotalMemory();
            this.currentMetrics.memoryPercentage = (this.currentMetrics.memoryUsed / this.currentMetrics.memoryTotal) * 100;
        }
    }

    /**
     * Update system metrics
     */
    private updateSystemMetrics(): void {
        // CPU usage estimation based on frame time
        const targetFrameTime = 1000 / 60; // 16.67ms for 60fps
        this.currentMetrics.cpuUsage = Math.min(100, (this.currentMetrics.frameTime / targetFrameTime) * 100);
        
        // Battery level (if available)
        if ('getBattery' in navigator) {
            (navigator as any).getBattery().then((battery: any) => {
                this.currentMetrics.batteryLevel = battery.level * 100;
            }).catch(() => {
                // Battery API not available
            });
        }
        
        // Thermal state estimation
        this.currentMetrics.thermalState = this.estimateThermalState();
    }

    /**
     * Update current metrics timestamp
     */
    private updateCurrentMetrics(now: number): void {
        this.currentMetrics.timestamp = now;
    }

    /**
     * Store metrics in history
     */
    private storeMetrics(): void {
        this.metrics.push({ ...this.currentMetrics });
        
        if (this.metrics.length > this.maxHistory) {
            this.metrics.shift();
        }
    }

    /**
     * Check performance thresholds
     */
    private checkThresholds(): void {
        // FPS threshold
        if (this.currentMetrics.fps < this.thresholds.fps.poor) {
            this.events.onThresholdExceeded?.('fps', this.currentMetrics.fps, this.thresholds.fps.poor);
        }
        
        // Memory threshold
        if (this.currentMetrics.memoryPercentage > this.thresholds.memory.critical) {
            this.events.onThresholdExceeded?.('memory', this.currentMetrics.memoryPercentage, this.thresholds.memory.critical);
        }
        
        // Frame time threshold
        if (this.currentMetrics.frameTime > this.thresholds.frameTime.critical) {
            this.events.onThresholdExceeded?.('frameTime', this.currentMetrics.frameTime, this.thresholds.frameTime.critical);
        }
    }

    /**
     * Perform optimization check
     */
    private performOptimizationCheck(): void {
        const recommendations = this.generateOptimizationRecommendations();
        
        if (recommendations.length > 0) {
            this.events.onOptimizationRecommended?.(recommendations);
            
            // Auto-apply critical recommendations
            recommendations.forEach(rec => {
                if (rec.automaticApply && rec.severity === 'critical') {
                    this.applyRecommendation(rec);
                }
            });
        }
    }

    /**
     * Generate optimization recommendations
     */
    private generateOptimizationRecommendations(): OptimizationRecommendation[] {
        const recommendations: OptimizationRecommendation[] = [];
        
        // Low FPS recommendations
        if (this.currentMetrics.fps < this.thresholds.fps.acceptable) {
            if (this.settings.renderScale > 0.75) {
                recommendations.push({
                    category: 'rendering',
                    severity: 'warning',
                    title: 'Reduce Render Scale',
                    description: 'Lower the render scale to improve performance',
                    impact: 'high',
                    settings: { renderScale: Math.max(0.5, this.settings.renderScale - 0.25) },
                    automaticApply: this.currentMetrics.fps < this.thresholds.fps.poor
                });
            }
            
            if (this.settings.particleQuality !== 'low') {
                recommendations.push({
                    category: 'rendering',
                    severity: 'warning',
                    title: 'Reduce Particle Quality',
                    description: 'Lower particle effects quality to improve performance',
                    impact: 'medium',
                    settings: { particleQuality: 'low' },
                    automaticApply: this.currentMetrics.fps < this.thresholds.fps.poor
                });
            }
            
            if (this.settings.postProcessing) {
                recommendations.push({
                    category: 'rendering',
                    severity: 'info',
                    title: 'Disable Post-Processing',
                    description: 'Turn off post-processing effects to improve performance',
                    impact: 'medium',
                    settings: { postProcessing: false },
                    automaticApply: false
                });
            }
        }
        
        // High memory usage recommendations
        if (this.currentMetrics.memoryPercentage > this.thresholds.memory.high) {
            recommendations.push({
                category: 'memory',
                severity: 'warning',
                title: 'Reduce Audio Sources',
                description: 'Limit the number of simultaneous audio sources',
                impact: 'low',
                settings: { maxAudioSources: Math.max(8, this.settings.maxAudioSources - 4) },
                automaticApply: this.currentMetrics.memoryPercentage > this.thresholds.memory.critical
            });
            
            recommendations.push({
                category: 'memory',
                severity: 'warning',
                title: 'Reduce LOD Distance',
                description: 'Decrease maximum render distance for objects',
                impact: 'medium',
                settings: { maxRenderDistance: this.settings.maxRenderDistance * 0.8 },
                automaticApply: this.currentMetrics.memoryPercentage > this.thresholds.memory.critical
            });
        }
        
        // Platform-specific recommendations
        if (this.platform === Platform.Mobile) {
            if (!this.settings.mobileLowPowerMode && this.currentMetrics.batteryLevel && this.currentMetrics.batteryLevel < 20) {
                recommendations.push({
                    category: 'general',
                    severity: 'info',
                    title: 'Enable Low Power Mode',
                    description: 'Activate power saving features for mobile devices',
                    impact: 'medium',
                    settings: { 
                        mobileLowPowerMode: true,
                        renderScale: 0.75,
                        particleQuality: 'low',
                        audioQuality: 'low'
                    },
                    automaticApply: false
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Apply optimization recommendation
     */
    applyRecommendation(recommendation: OptimizationRecommendation): void {
        const oldSettings = { ...this.settings };
        
        // Apply settings changes
        Object.assign(this.settings, recommendation.settings);
        
        this.events.onSettingsChanged?.(this.settings);
        
        this.logger.info(`Applied optimization: ${recommendation.title}`, {
            category: recommendation.category,
            impact: recommendation.impact,
            settings: recommendation.settings
        });
    }

    /**
     * Get default performance thresholds
     */
    private getDefaultThresholds(): PerformanceThresholds {
        return {
            fps: {
                excellent: 60,
                good: 45,
                acceptable: 30,
                poor: 20
            },
            memory: {
                low: 25,     // 25% of available memory
                medium: 50,  // 50% of available memory
                high: 75,    // 75% of available memory
                critical: 90 // 90% of available memory
            },
            frameTime: {
                target: 16.67,   // 60fps target
                warning: 33.33,  // 30fps warning
                critical: 50     // 20fps critical
            }
        };
    }

    /**
     * Get default performance settings
     */
    private getDefaultSettings(): PerformanceSettings {
        const baseSettings: PerformanceSettings = {
            renderScale: 1.0,
            particleQuality: 'high',
            shadowQuality: 'medium',
            postProcessing: true,
            bloom: true,
            antiAliasing: true,
            lodBias: 1.0,
            maxRenderDistance: 1000,
            audioQuality: 'high',
            maxAudioSources: 32,
            physicsSteps: 60,
            collisionComplexity: 'medium',
            mobileLowPowerMode: false,
            vsync: true,
            autoOptimize: true,
            adaptiveQuality: true
        };
        
        // Platform-specific adjustments
        switch (this.platform) {
            case Platform.Mobile:
                return {
                    ...baseSettings,
                    renderScale: 0.8,
                    particleQuality: 'medium',
                    shadowQuality: 'low',
                    postProcessing: false,
                    bloom: false,
                    antiAliasing: false,
                    maxRenderDistance: 500,
                    audioQuality: 'medium',
                    maxAudioSources: 16,
                    physicsSteps: 30,
                    collisionComplexity: 'simple'
                };
                
            case Platform.Desktop:
                return baseSettings;
                
            default:
                return {
                    ...baseSettings,
                    renderScale: 0.9,
                    particleQuality: 'medium',
                    shadowQuality: 'medium'
                };
        }
    }

    /**
     * Create empty metrics object
     */
    private createEmptyMetrics(): PerformanceMetrics {
        return {
            fps: 0,
            frameTime: 0,
            deltaTime: 0,
            memoryUsed: 0,
            memoryTotal: 0,
            memoryPercentage: 0,
            drawCalls: 0,
            triangles: 0,
            cpuUsage: 0,
            activeEntities: 0,
            activeSounds: 0,
            textureMemory: 0,
            timestamp: 0
        };
    }

    /**
     * Get average FPS from history
     */
    private getAverageFPS(): number {
        if (this.fpsHistory.length === 0) return 0;
        
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }

    /**
     * Estimate memory usage (fallback)
     */
    private estimateMemoryUsage(): number {
        // Rough estimation based on platform and active entities
        const baseMemory = this.platform === Platform.Mobile ? 50 : 100; // MB
        const entityMemory = this.currentMetrics.activeEntities * 0.1; // 0.1MB per entity
        const audioMemory = this.currentMetrics.activeSounds * 2; // 2MB per sound
        
        return baseMemory + entityMemory + audioMemory;
    }

    /**
     * Estimate total memory (fallback)
     */
    private estimateTotalMemory(): number {
        switch (this.platform) {
            case Platform.Mobile:
                return 1024; // 1GB typical mobile
            case Platform.Desktop:
                return 4096; // 4GB typical desktop
            default:
                return 2048; // 2GB fallback
        }
    }

    /**
     * Estimate thermal state
     */
    private estimateThermalState(): PerformanceMetrics['thermalState'] {
        // Estimate based on CPU usage and sustained performance
        if (this.currentMetrics.cpuUsage > 90) return 'critical';
        if (this.currentMetrics.cpuUsage > 75) return 'serious';
        if (this.currentMetrics.cpuUsage > 50) return 'fair';
        return 'normal';
    }

    /**
     * Enable auto-optimization
     */
    private enableAutoOptimization(): void {
        this.settings.autoOptimize = true;
        this.settings.adaptiveQuality = true;
        
        this.logger.info('🔧 Auto-optimization enabled');
    }

    /**
     * Set game-specific metrics
     */
    setGameMetrics(metrics: {
        activeEntities?: number;
        activeSounds?: number;
        drawCalls?: number;
        triangles?: number;
        textureMemory?: number;
    }): void {
        if (metrics.activeEntities !== undefined) this.currentMetrics.activeEntities = metrics.activeEntities;
        if (metrics.activeSounds !== undefined) this.currentMetrics.activeSounds = metrics.activeSounds;
        if (metrics.drawCalls !== undefined) this.currentMetrics.drawCalls = metrics.drawCalls;
        if (metrics.triangles !== undefined) this.currentMetrics.triangles = metrics.triangles;
        if (metrics.textureMemory !== undefined) this.currentMetrics.textureMemory = metrics.textureMemory;
    }

    /**
     * Get current performance metrics
     */
    getCurrentMetrics(): PerformanceMetrics {
        return { ...this.currentMetrics };
    }

    /**
     * Get metrics history
     */
    getMetricsHistory(duration?: number): PerformanceMetrics[] {
        if (!duration) return [...this.metrics];
        
        const cutoff = Date.now() - duration;
        return this.metrics.filter(m => m.timestamp >= cutoff);
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary(): {
        averageFPS: number;
        minFPS: number;
        maxFPS: number;
        averageFrameTime: number;
        averageMemoryUsage: number;
        performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
    } {
        const recentMetrics = this.getMetricsHistory(60000); // Last minute
        
        if (recentMetrics.length === 0) {
            return {
                averageFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                averageFrameTime: 0,
                averageMemoryUsage: 0,
                performanceGrade: 'poor'
            };
        }
        
        const fps = recentMetrics.map(m => m.fps);
        const frameTime = recentMetrics.map(m => m.frameTime);
        const memory = recentMetrics.map(m => m.memoryPercentage);
        
        const averageFPS = fps.reduce((a, b) => a + b, 0) / fps.length;
        const minFPS = Math.min(...fps);
        const maxFPS = Math.max(...fps);
        const averageFrameTime = frameTime.reduce((a, b) => a + b, 0) / frameTime.length;
        const averageMemoryUsage = memory.reduce((a, b) => a + b, 0) / memory.length;
        
        // Determine performance grade
        let performanceGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
        if (averageFPS >= this.thresholds.fps.excellent && averageMemoryUsage < this.thresholds.memory.medium) {
            performanceGrade = 'excellent';
        } else if (averageFPS >= this.thresholds.fps.good && averageMemoryUsage < this.thresholds.memory.high) {
            performanceGrade = 'good';
        } else if (averageFPS >= this.thresholds.fps.acceptable) {
            performanceGrade = 'acceptable';
        } else {
            performanceGrade = 'poor';
        }
        
        return {
            averageFPS,
            minFPS,
            maxFPS,
            averageFrameTime,
            averageMemoryUsage,
            performanceGrade
        };
    }

    /**
     * Update performance settings
     */
    updateSettings(newSettings: Partial<PerformanceSettings>): void {
        const oldSettings = { ...this.settings };
        Object.assign(this.settings, newSettings);
        
        this.events.onSettingsChanged?.(this.settings);
        
        this.logger.info('⚙️ Performance settings updated', {
            changes: Object.keys(newSettings),
            newSettings
        });
    }

    /**
     * Get current settings
     */
    getSettings(): PerformanceSettings {
        return { ...this.settings };
    }

    /**
     * Reset to default settings
     */
    resetToDefaults(): void {
        this.settings = this.getDefaultSettings();
        this.events.onSettingsChanged?.(this.settings);
        
        this.logger.info('↩️ Performance settings reset to defaults');
    }

    /**
     * Dispose performance monitor
     */
    dispose(): void {
        if (this.memoryObserver) {
            this.memoryObserver.disconnect();
            this.memoryObserver = null;
        }
        
        this.metrics = [];
        this.fpsHistory = [];
        
        this.logger.info('📊 Performance monitor disposed');
    }
}