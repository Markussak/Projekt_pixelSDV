/**
 * Advanced Logging System for Space Explorer
 * Provides structured logging with different levels and platform detection
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    CRITICAL = 4
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    module: string;
    message: string;
    data?: any;
    stack?: string;
}

export class Logger {
    private static globalLevel: LogLevel = LogLevel.INFO;
    private static entries: LogEntry[] = [];
    private static maxEntries = 1000;
    private static enableConsole = true;
    private static enableStorage = false;

    private module: string;

    constructor(module: string) {
        this.module = module;
    }

    /**
     * Configure global logger settings
     */
    static configure(config: {
        level?: LogLevel;
        maxEntries?: number;
        enableConsole?: boolean;
        enableStorage?: boolean;
    }): void {
        if (config.level !== undefined) Logger.globalLevel = config.level;
        if (config.maxEntries !== undefined) Logger.maxEntries = config.maxEntries;
        if (config.enableConsole !== undefined) Logger.enableConsole = config.enableConsole;
        if (config.enableStorage !== undefined) Logger.enableStorage = config.enableStorage;
    }

    /**
     * Set global log level
     */
    static setLevel(level: LogLevel): void {
        Logger.globalLevel = level;
    }

    /**
     * Log debug information
     */
    debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * Log informational messages
     */
    info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    /**
     * Log warnings
     */
    warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, message, data);
    }

    /**
     * Log errors
     */
    error(message: string, error?: any): void {
        let stack: string | undefined;
        let data = error;

        if (error instanceof Error) {
            stack = error.stack;
            data = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        this.log(LogLevel.ERROR, message, data, stack);
    }

    /**
     * Log critical errors
     */
    critical(message: string, error?: any): void {
        let stack: string | undefined;
        let data = error;

        if (error instanceof Error) {
            stack = error.stack;
            data = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        this.log(LogLevel.CRITICAL, message, data, stack);
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, message: string, data?: any, stack?: string): void {
        // Check if this level should be logged
        if (level < Logger.globalLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            module: this.module,
            message,
            data,
            stack
        };

        // Add to entries buffer
        Logger.addEntry(entry);

        // Output to console if enabled
        if (Logger.enableConsole) {
            Logger.outputToConsole(entry);
        }

        // Store if enabled
        if (Logger.enableStorage) {
            Logger.storeEntry(entry);
        }
    }

    /**
     * Add entry to buffer
     */
    private static addEntry(entry: LogEntry): void {
        this.entries.push(entry);

        // Maintain buffer size
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
    }

    /**
     * Output entry to console with proper formatting
     */
    private static outputToConsole(entry: LogEntry): void {
        const timestamp = new Date(entry.timestamp).toISOString();
        const levelName = LogLevel[entry.level];
        const prefix = `[${timestamp}] [${levelName}] [${entry.module}]`;

        // Choose console method based on level
        let consoleMethod: 'debug' | 'log' | 'warn' | 'error';
        let style = '';

        switch (entry.level) {
            case LogLevel.DEBUG:
                consoleMethod = 'debug';
                style = 'color: #888; font-size: 11px;';
                break;
            case LogLevel.INFO:
                consoleMethod = 'log';
                style = 'color: #0f0; font-weight: bold;';
                break;
            case LogLevel.WARN:
                consoleMethod = 'warn';
                style = 'color: #ff0; font-weight: bold;';
                break;
            case LogLevel.ERROR:
                consoleMethod = 'error';
                style = 'color: #f00; font-weight: bold;';
                break;
            case LogLevel.CRITICAL:
                consoleMethod = 'error';
                style = 'color: #f00; font-weight: bold; background: #400;';
                break;
            default:
                consoleMethod = 'log';
        }

        // Format message
        if (entry.data !== undefined) {
            console[consoleMethod](`%c${prefix} ${entry.message}`, style, entry.data);
        } else {
            console[consoleMethod](`%c${prefix} ${entry.message}`, style);
        }

        // Show stack trace for errors
        if (entry.stack && (entry.level === LogLevel.ERROR || entry.level === LogLevel.CRITICAL)) {
            console.groupCollapsed('Stack Trace');
            console.error(entry.stack);
            console.groupEnd();
        }
    }

    /**
     * Store entry to persistent storage
     */
    private static async storeEntry(entry: LogEntry): Promise<void> {
        try {
            // Store in localStorage for now (could be enhanced for different platforms)
            const stored = localStorage.getItem('spaceExplorer_logs');
            const logs = stored ? JSON.parse(stored) : [];
            
            logs.push(entry);
            
            // Keep only recent entries
            if (logs.length > this.maxEntries) {
                logs.splice(0, logs.length - this.maxEntries);
            }
            
            localStorage.setItem('spaceExplorer_logs', JSON.stringify(logs));
        } catch (error) {
            // Silently fail if storage is not available
            console.warn('Failed to store log entry:', error);
        }
    }

    /**
     * Get all log entries
     */
    static getEntries(): LogEntry[] {
        return [...this.entries];
    }

    /**
     * Get entries filtered by level
     */
    static getEntriesByLevel(level: LogLevel): LogEntry[] {
        return this.entries.filter(entry => entry.level === level);
    }

    /**
     * Get entries filtered by module
     */
    static getEntriesByModule(module: string): LogEntry[] {
        return this.entries.filter(entry => entry.module === module);
    }

    /**
     * Clear all log entries
     */
    static clear(): void {
        this.entries = [];
        
        if (this.enableStorage) {
            try {
                localStorage.removeItem('spaceExplorer_logs');
            } catch (error) {
                // Silently fail
            }
        }
    }

    /**
     * Export logs as JSON string
     */
    static export(): string {
        return JSON.stringify({
            exported: new Date().toISOString(),
            platform: navigator.userAgent,
            entries: this.entries
        }, null, 2);
    }

    /**
     * Load logs from storage
     */
    static async loadFromStorage(): Promise<void> {
        try {
            const stored = localStorage.getItem('spaceExplorer_logs');
            if (stored) {
                const logs = JSON.parse(stored);
                this.entries = logs.slice(-this.maxEntries);
            }
        } catch (error) {
            console.warn('Failed to load logs from storage:', error);
        }
    }

    /**
     * Performance logging utility
     */
    static performance = {
        timers: new Map<string, number>(),

        start(name: string): void {
            this.timers.set(name, performance.now());
        },

        end(name: string, logger?: Logger): number {
            const startTime = this.timers.get(name);
            if (startTime === undefined) {
                console.warn(`Timer "${name}" was not started`);
                return 0;
            }

            const duration = performance.now() - startTime;
            this.timers.delete(name);

            if (logger) {
                logger.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`);
            }

            return duration;
        },

        measure<T>(name: string, fn: () => T, logger?: Logger): T {
            this.start(name);
            try {
                const result = fn();
                this.end(name, logger);
                return result;
            } catch (error) {
                this.end(name, logger);
                throw error;
            }
        },

        async measureAsync<T>(name: string, fn: () => Promise<T>, logger?: Logger): Promise<T> {
            this.start(name);
            try {
                const result = await fn();
                this.end(name, logger);
                return result;
            } catch (error) {
                this.end(name, logger);
                throw error;
            }
        }
    };

    /**
     * Create module-specific performance logger
     */
    createPerformanceLogger() {
        return {
            start: (name: string) => Logger.performance.start(`${this.module}:${name}`),
            end: (name: string) => Logger.performance.end(`${this.module}:${name}`, this),
            measure: <T>(name: string, fn: () => T) => 
                Logger.performance.measure(`${this.module}:${name}`, fn, this),
            measureAsync: <T>(name: string, fn: () => Promise<T>) => 
                Logger.performance.measureAsync(`${this.module}:${name}`, fn, this)
        };
    }
}

// Configure logger based on environment
if (import.meta.env.DEV) {
    Logger.configure({
        level: LogLevel.DEBUG,
        enableConsole: true,
        enableStorage: true
    });
} else {
    Logger.configure({
        level: LogLevel.INFO,
        enableConsole: false,
        enableStorage: true
    });
}

// Load existing logs
Logger.loadFromStorage();