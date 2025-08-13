/**
 * Platform Detection and Management
 * Handles different deployment targets and adaptive features
 */

export enum Platform {
    Desktop = 'desktop',
    Mobile = 'mobile',
    Web = 'web',
    Tauri = 'tauri',
    Cordova = 'cordova'
}

export interface PlatformFeatures {
    hasKeyboard: boolean;
    hasTouch: boolean;
    hasFileSystem: boolean;
    hasFullscreen: boolean;
    canVibrate: boolean;
    preferredInputMethod: 'keyboard' | 'touch' | 'hybrid';
    storageType: 'localStorage' | 'fileSystem' | 'indexedDB';
}

export class PlatformDetector {
    private static cachedPlatform: Platform | null = null;
    private static cachedFeatures: PlatformFeatures | null = null;

    /**
     * Detect the current platform
     */
    static detect(): Platform {
        if (this.cachedPlatform) {
            return this.cachedPlatform;
        }

        // Check for Tauri (desktop app)
        if ((window as any).__TAURI__) {
            this.cachedPlatform = Platform.Tauri;
            return this.cachedPlatform;
        }

        // Check for Cordova (mobile app)
        if ((window as any).cordova) {
            this.cachedPlatform = Platform.Cordova;
            return this.cachedPlatform;
        }

        // Check for mobile browser
        if (this.isMobile()) {
            this.cachedPlatform = Platform.Mobile;
            return this.cachedPlatform;
        }

        // Check for desktop browser
        if (this.isDesktop()) {
            this.cachedPlatform = Platform.Desktop;
            return this.cachedPlatform;
        }

        // Default to web
        this.cachedPlatform = Platform.Web;
        return this.cachedPlatform;
    }

    /**
     * Get platform-specific features
     */
    static getFeatures(): PlatformFeatures {
        if (this.cachedFeatures) {
            return this.cachedFeatures;
        }

        const platform = this.detect();
        
        this.cachedFeatures = {
            hasKeyboard: this.hasKeyboard(platform),
            hasTouch: this.hasTouch(),
            hasFileSystem: this.hasFileSystem(platform),
            hasFullscreen: this.hasFullscreen(),
            canVibrate: this.canVibrate(),
            preferredInputMethod: this.getPreferredInput(platform),
            storageType: this.getStorageType(platform)
        };

        return this.cachedFeatures;
    }

    /**
     * Check if running on mobile device
     */
    private static isMobile(): boolean {
        // Check user agent
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        
        // Check for mobile patterns
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        if (mobileRegex.test(userAgent)) {
            return true;
        }

        // Check for touch capability and small screen
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const smallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
        
        return hasTouch && smallScreen;
    }

    /**
     * Check if running on desktop
     */
    private static isDesktop(): boolean {
        // Check for desktop-specific features
        const hasKeyboard = !this.isMobile();
        const largeScreen = window.innerWidth > 768 && window.innerHeight > 768;
        
        // Check user agent for desktop patterns
        const userAgent = navigator.userAgent;
        const desktopOS = /windows|mac|linux/i.test(userAgent);
        
        return hasKeyboard && largeScreen && desktopOS;
    }

    /**
     * Check if platform has keyboard support
     */
    private static hasKeyboard(platform: Platform): boolean {
        switch (platform) {
            case Platform.Desktop:
            case Platform.Tauri:
                return true;
            case Platform.Mobile:
            case Platform.Cordova:
                return false;
            case Platform.Web:
                return !this.isMobile();
            default:
                return true;
        }
    }

    /**
     * Check if platform has touch support
     */
    private static hasTouch(): boolean {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Check if platform has file system access
     */
    private static hasFileSystem(platform: Platform): boolean {
        switch (platform) {
            case Platform.Tauri:
            case Platform.Cordova:
                return true;
            default:
                return false;
        }
    }

    /**
     * Check if platform supports fullscreen
     */
    private static hasFullscreen(): boolean {
        return !!(
            document.fullscreenEnabled ||
            (document as any).webkitFullscreenEnabled ||
            (document as any).mozFullScreenEnabled ||
            (document as any).msFullscreenEnabled
        );
    }

    /**
     * Check if platform can vibrate
     */
    private static canVibrate(): boolean {
        return 'vibrate' in navigator;
    }

    /**
     * Get preferred input method for platform
     */
    private static getPreferredInput(platform: Platform): 'keyboard' | 'touch' | 'hybrid' {
        switch (platform) {
            case Platform.Desktop:
            case Platform.Tauri:
                return 'keyboard';
            case Platform.Mobile:
            case Platform.Cordova:
                return 'touch';
            case Platform.Web:
                return this.hasTouch() ? 'hybrid' : 'keyboard';
            default:
                return 'hybrid';
        }
    }

    /**
     * Get storage type for platform
     */
    private static getStorageType(platform: Platform): 'localStorage' | 'fileSystem' | 'indexedDB' {
        switch (platform) {
            case Platform.Tauri:
            case Platform.Cordova:
                return 'fileSystem';
            case Platform.Desktop:
            case Platform.Mobile:
            case Platform.Web:
                return 'indexedDB';
            default:
                return 'localStorage';
        }
    }

    /**
     * Get platform-specific configuration
     */
    static getConfig() {
        const platform = this.detect();
        const features = this.getFeatures();

        return {
            platform,
            features,
            canvas: {
                // Adjust canvas settings based on platform
                pixelRatio: window.devicePixelRatio || 1,
                maxWidth: features.hasTouch ? 800 : 1024,
                maxHeight: features.hasTouch ? 600 : 768,
                scalingMode: features.hasTouch ? 'fit' : 'native'
            },
            input: {
                // Input configuration
                enableKeyboard: features.hasKeyboard,
                enableTouch: features.hasTouch,
                enableGamepad: platform === Platform.Desktop || platform === Platform.Tauri,
                touchSensitivity: features.hasTouch ? 1.0 : 0.0,
                keyRepeatDelay: 250,
                keyRepeatRate: 50
            },
            performance: {
                // Performance settings based on platform
                targetFPS: platform === Platform.Mobile ? 30 : 60,
                enableParticles: platform !== Platform.Mobile,
                enablePostProcessing: platform === Platform.Desktop || platform === Platform.Tauri,
                enableShadows: platform === Platform.Desktop,
                enableDithering: true, // Always enable for 16-bit aesthetic
                renderScale: features.hasTouch ? 0.8 : 1.0
            },
            audio: {
                // Audio settings
                enableAudio: true,
                enableMusic: true,
                enableSFX: true,
                enableSpatialAudio: platform === Platform.Desktop,
                audioFormat: 'webm', // Fallback to mp3 if needed
                maxChannels: platform === Platform.Mobile ? 8 : 16
            },
            storage: {
                // Storage configuration
                type: features.storageType,
                enableAutoSave: true,
                saveInterval: 30000, // 30 seconds
                maxSaveSlots: platform === Platform.Mobile ? 3 : 10,
                compressionEnabled: true
            }
        };
    }

    /**
     * Check if platform supports specific feature
     */
    static supports(feature: keyof PlatformFeatures): boolean {
        return Boolean(this.getFeatures()[feature]);
    }

    /**
     * Get human-readable platform name
     */
    static getPlatformName(): string {
        switch (this.detect()) {
            case Platform.Desktop:
                return 'Desktop Browser';
            case Platform.Mobile:
                return 'Mobile Browser';
            case Platform.Web:
                return 'Web Browser';
            case Platform.Tauri:
                return 'Desktop Application';
            case Platform.Cordova:
                return 'Mobile Application';
            default:
                return 'Unknown Platform';
        }
    }

    /**
     * Reset cached values (useful for testing)
     */
    static reset(): void {
        this.cachedPlatform = null;
        this.cachedFeatures = null;
    }
}