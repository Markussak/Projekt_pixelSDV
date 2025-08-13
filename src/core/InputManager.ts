/**
 * Input Management System
 * Handles keyboard, mouse, and touch input with platform-specific adaptations
 */

import { Platform } from '@utils/Platform';
import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';

export interface InputState {
    // Keyboard
    keys: Set<string>;
    keysPressed: Set<string>;
    keysReleased: Set<string>;
    
    // Mouse
    mousePosition: Vector2;
    mouseButtons: Set<number>;
    mouseButtonsPressed: Set<number>;
    mouseButtonsReleased: Set<number>;
    mouseWheel: number;
    
    // Touch
    touches: Touch[];
    touchStarted: boolean;
    touchEnded: boolean;
    
    // Virtual controls for mobile
    virtualThrust: number;
    virtualRotation: number;
    virtualAction: boolean;
}

export interface GamepadState {
    connected: boolean;
    axes: number[];
    buttons: boolean[];
}

export class InputManager {
    private canvas: HTMLCanvasElement;
    private platform: Platform;
    private currentState: InputState;
    private previousState: InputState;
    
    // Gamepad support
    private gamepads: Map<number, GamepadState> = new Map();
    
    // Touch controls
    private touchZones: Map<string, TouchZone> = new Map();
    private activeTouches: Map<number, TouchInfo> = new Map();
    
    // Input configuration
    private config = {
        enableKeyboard: true,
        enableMouse: true,
        enableTouch: true,
        enableGamepad: true,
        touchSensitivity: 1.0,
        keyRepeatDelay: 250,
        keyRepeatRate: 50
    };
    
    private logger: Logger;
    private eventListeners: Array<() => void> = [];

    constructor(canvas: HTMLCanvasElement, platform: Platform) {
        this.canvas = canvas;
        this.platform = platform;
        this.logger = new Logger('InputManager');
        
        // Initialize input states
        this.currentState = this.createEmptyInputState();
        this.previousState = this.createEmptyInputState();
        
        // Configure input based on platform
        this.configureForPlatform();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup touch zones for mobile
        if (this.config.enableTouch) {
            this.setupTouchZones();
        }
        
        this.logger.info('🎮 Input manager initialized', {
            platform: platform,
            config: this.config
        });
    }

    /**
     * Configure input settings based on platform
     */
    private configureForPlatform(): void {
        switch (this.platform) {
            case Platform.Desktop:
            case Platform.Tauri:
                this.config.enableKeyboard = true;
                this.config.enableMouse = true;
                this.config.enableTouch = false;
                this.config.enableGamepad = true;
                break;
                
            case Platform.Mobile:
            case Platform.Cordova:
                this.config.enableKeyboard = false;
                this.config.enableMouse = false;
                this.config.enableTouch = true;
                this.config.enableGamepad = false;
                this.config.touchSensitivity = 1.5;
                break;
                
            case Platform.Web:
                // Hybrid mode - detect capabilities
                this.config.enableKeyboard = true;
                this.config.enableMouse = true;
                this.config.enableTouch = 'ontouchstart' in window;
                this.config.enableGamepad = 'getGamepads' in navigator;
                break;
        }
    }

    /**
     * Setup event listeners for input
     */
    private setupEventListeners(): void {
        // Keyboard events
        if (this.config.enableKeyboard) {
            const keyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
            const keyUpHandler = (e: KeyboardEvent) => this.handleKeyUp(e);
            
            document.addEventListener('keydown', keyDownHandler);
            document.addEventListener('keyup', keyUpHandler);
            
            this.eventListeners.push(() => {
                document.removeEventListener('keydown', keyDownHandler);
                document.removeEventListener('keyup', keyUpHandler);
            });
        }
        
        // Mouse events
        if (this.config.enableMouse) {
            const mouseMoveHandler = (e: MouseEvent) => this.handleMouseMove(e);
            const mouseDownHandler = (e: MouseEvent) => this.handleMouseDown(e);
            const mouseUpHandler = (e: MouseEvent) => this.handleMouseUp(e);
            const wheelHandler = (e: WheelEvent) => this.handleWheel(e);
            
            this.canvas.addEventListener('mousemove', mouseMoveHandler);
            this.canvas.addEventListener('mousedown', mouseDownHandler);
            this.canvas.addEventListener('mouseup', mouseUpHandler);
            this.canvas.addEventListener('wheel', wheelHandler);
            
            this.eventListeners.push(() => {
                this.canvas.removeEventListener('mousemove', mouseMoveHandler);
                this.canvas.removeEventListener('mousedown', mouseDownHandler);
                this.canvas.removeEventListener('mouseup', mouseUpHandler);
                this.canvas.removeEventListener('wheel', wheelHandler);
            });
        }
        
        // Touch events
        if (this.config.enableTouch) {
            const touchStartHandler = (e: TouchEvent) => this.handleTouchStart(e);
            const touchMoveHandler = (e: TouchEvent) => this.handleTouchMove(e);
            const touchEndHandler = (e: TouchEvent) => this.handleTouchEnd(e);
            
            this.canvas.addEventListener('touchstart', touchStartHandler, { passive: false });
            this.canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
            this.canvas.addEventListener('touchend', touchEndHandler, { passive: false });
            
            this.eventListeners.push(() => {
                this.canvas.removeEventListener('touchstart', touchStartHandler);
                this.canvas.removeEventListener('touchmove', touchMoveHandler);
                this.canvas.removeEventListener('touchend', touchEndHandler);
            });
        }
        
        // Gamepad events
        if (this.config.enableGamepad) {
            const gamepadConnectedHandler = (e: GamepadEvent) => this.handleGamepadConnected(e);
            const gamepadDisconnectedHandler = (e: GamepadEvent) => this.handleGamepadDisconnected(e);
            
            window.addEventListener('gamepadconnected', gamepadConnectedHandler);
            window.addEventListener('gamepaddisconnected', gamepadDisconnectedHandler);
            
            this.eventListeners.push(() => {
                window.removeEventListener('gamepadconnected', gamepadConnectedHandler);
                window.removeEventListener('gamepaddisconnected', gamepadDisconnectedHandler);
            });
        }
        
        // Focus events to handle window focus
        const focusHandler = () => this.handleFocus();
        const blurHandler = () => this.handleBlur();
        
        window.addEventListener('focus', focusHandler);
        window.addEventListener('blur', blurHandler);
        
        this.eventListeners.push(() => {
            window.removeEventListener('focus', focusHandler);
            window.removeEventListener('blur', blurHandler);
        });
    }

    /**
     * Setup touch zones for mobile controls
     */
    private setupTouchZones(): void {
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // Left side - thrust control
        this.touchZones.set('thrust', {
            x: 0,
            y: 0,
            width: canvasRect.width / 2,
            height: canvasRect.height,
            type: 'joystick'
        });
        
        // Right side - rotation control
        this.touchZones.set('rotation', {
            x: canvasRect.width / 2,
            y: 0,
            width: canvasRect.width / 2,
            height: canvasRect.height,
            type: 'joystick'
        });
        
        this.logger.debug('Touch zones configured for mobile controls');
    }

    /**
     * Update input state (called each frame)
     */
    update(deltaTime: number): void {
        // Copy current state to previous
        this.previousState = this.deepCopyInputState(this.currentState);
        
        // Clear frame-specific states
        this.currentState.keysPressed.clear();
        this.currentState.keysReleased.clear();
        this.currentState.mouseButtonsPressed.clear();
        this.currentState.mouseButtonsReleased.clear();
        this.currentState.mouseWheel = 0;
        this.currentState.touchStarted = false;
        this.currentState.touchEnded = false;
        
        // Update gamepad state
        if (this.config.enableGamepad) {
            this.updateGamepadState();
        }
        
        // Update virtual controls from touch input
        if (this.config.enableTouch) {
            this.updateVirtualControls();
        }
    }

    /**
     * Keyboard event handlers
     */
    private handleKeyDown(e: KeyboardEvent): void {
        const key = e.code;
        
        if (!this.currentState.keys.has(key)) {
            this.currentState.keysPressed.add(key);
            this.logger.debug(`Key pressed: ${key}`);
        }
        
        this.currentState.keys.add(key);
        
        // Prevent default for game keys
        if (this.isGameKey(key)) {
            e.preventDefault();
        }
    }

    private handleKeyUp(e: KeyboardEvent): void {
        const key = e.code;
        
        if (this.currentState.keys.has(key)) {
            this.currentState.keysReleased.add(key);
            this.logger.debug(`Key released: ${key}`);
        }
        
        this.currentState.keys.delete(key);
        
        if (this.isGameKey(key)) {
            e.preventDefault();
        }
    }

    /**
     * Mouse event handlers
     */
    private handleMouseMove(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        this.currentState.mousePosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private handleMouseDown(e: MouseEvent): void {
        const button = e.button;
        
        if (!this.currentState.mouseButtons.has(button)) {
            this.currentState.mouseButtonsPressed.add(button);
        }
        
        this.currentState.mouseButtons.add(button);
        e.preventDefault();
    }

    private handleMouseUp(e: MouseEvent): void {
        const button = e.button;
        
        if (this.currentState.mouseButtons.has(button)) {
            this.currentState.mouseButtonsReleased.add(button);
        }
        
        this.currentState.mouseButtons.delete(button);
        e.preventDefault();
    }

    private handleWheel(e: WheelEvent): void {
        this.currentState.mouseWheel = e.deltaY;
        e.preventDefault();
    }

    /**
     * Touch event handlers
     */
    private handleTouchStart(e: TouchEvent): void {
        this.currentState.touchStarted = true;
        this.currentState.touches = Array.from(e.touches);
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.activeTouches.set(touch.identifier, {
                id: touch.identifier,
                startPosition: { x: touch.clientX, y: touch.clientY },
                currentPosition: { x: touch.clientX, y: touch.clientY },
                zone: this.getTouchZone(touch.clientX, touch.clientY)
            });
        }
        
        e.preventDefault();
    }

    private handleTouchMove(e: TouchEvent): void {
        this.currentState.touches = Array.from(e.touches);
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchInfo = this.activeTouches.get(touch.identifier);
            
            if (touchInfo) {
                touchInfo.currentPosition = { x: touch.clientX, y: touch.clientY };
            }
        }
        
        e.preventDefault();
    }

    private handleTouchEnd(e: TouchEvent): void {
        this.currentState.touchEnded = true;
        this.currentState.touches = Array.from(e.touches);
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.activeTouches.delete(touch.identifier);
        }
        
        e.preventDefault();
    }

    /**
     * Gamepad event handlers
     */
    private handleGamepadConnected(e: GamepadEvent): void {
        this.logger.info(`Gamepad connected: ${e.gamepad.id}`);
        this.gamepads.set(e.gamepad.index, {
            connected: true,
            axes: [],
            buttons: []
        });
    }

    private handleGamepadDisconnected(e: GamepadEvent): void {
        this.logger.info(`Gamepad disconnected: ${e.gamepad.id}`);
        this.gamepads.delete(e.gamepad.index);
    }

    /**
     * Update gamepad state
     */
    private updateGamepadState(): void {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && this.gamepads.has(i)) {
                const state = this.gamepads.get(i)!;
                state.axes = Array.from(gamepad.axes);
                state.buttons = gamepad.buttons.map(button => button.pressed);
            }
        }
    }

    /**
     * Update virtual controls from touch input
     */
    private updateVirtualControls(): void {
        this.currentState.virtualThrust = 0;
        this.currentState.virtualRotation = 0;
        this.currentState.virtualAction = false;
        
        for (const [touchId, touchInfo] of this.activeTouches) {
            const deltaX = touchInfo.currentPosition.x - touchInfo.startPosition.x;
            const deltaY = touchInfo.currentPosition.y - touchInfo.startPosition.y;
            
            if (touchInfo.zone === 'thrust') {
                // Vertical movement controls thrust
                this.currentState.virtualThrust = -deltaY / 100 * this.config.touchSensitivity;
                this.currentState.virtualThrust = Math.max(-1, Math.min(1, this.currentState.virtualThrust));
            } else if (touchInfo.zone === 'rotation') {
                // Horizontal movement controls rotation
                this.currentState.virtualRotation = deltaX / 100 * this.config.touchSensitivity;
                this.currentState.virtualRotation = Math.max(-1, Math.min(1, this.currentState.virtualRotation));
            }
        }
    }

    /**
     * Focus/blur handlers
     */
    private handleFocus(): void {
        this.logger.debug('Window focused - input enabled');
    }

    private handleBlur(): void {
        // Clear all input states when window loses focus
        this.currentState.keys.clear();
        this.currentState.mouseButtons.clear();
        this.activeTouches.clear();
        this.logger.debug('Window blurred - input cleared');
    }

    /**
     * Helper methods
     */
    private createEmptyInputState(): InputState {
        return {
            keys: new Set(),
            keysPressed: new Set(),
            keysReleased: new Set(),
            mousePosition: { x: 0, y: 0 },
            mouseButtons: new Set(),
            mouseButtonsPressed: new Set(),
            mouseButtonsReleased: new Set(),
            mouseWheel: 0,
            touches: [],
            touchStarted: false,
            touchEnded: false,
            virtualThrust: 0,
            virtualRotation: 0,
            virtualAction: false
        };
    }

    private deepCopyInputState(state: InputState): InputState {
        return {
            keys: new Set(state.keys),
            keysPressed: new Set(),
            keysReleased: new Set(),
            mousePosition: { ...state.mousePosition },
            mouseButtons: new Set(state.mouseButtons),
            mouseButtonsPressed: new Set(),
            mouseButtonsReleased: new Set(),
            mouseWheel: 0,
            touches: [...state.touches],
            touchStarted: false,
            touchEnded: false,
            virtualThrust: state.virtualThrust,
            virtualRotation: state.virtualRotation,
            virtualAction: state.virtualAction
        };
    }

    private isGameKey(key: string): boolean {
        const gameKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'Space', 'Enter', 'Escape'
        ];
        return gameKeys.includes(key);
    }

    private getTouchZone(x: number, y: number): string | null {
        for (const [zoneName, zone] of this.touchZones) {
            if (x >= zone.x && x < zone.x + zone.width &&
                y >= zone.y && y < zone.y + zone.height) {
                return zoneName;
            }
        }
        return null;
    }

    /**
     * Public input query methods
     */
    isKeyDown(key: string): boolean {
        return this.currentState.keys.has(key);
    }

    isKeyPressed(key: string): boolean {
        return this.currentState.keysPressed.has(key);
    }

    isKeyReleased(key: string): boolean {
        return this.currentState.keysReleased.has(key);
    }

    isMouseButtonDown(button: number): boolean {
        return this.currentState.mouseButtons.has(button);
    }

    isMouseButtonPressed(button: number): boolean {
        return this.currentState.mouseButtonsPressed.has(button);
    }

    getMousePosition(): Vector2 {
        return { ...this.currentState.mousePosition };
    }

    getMouseWheel(): number {
        return this.currentState.mouseWheel;
    }

    getTouchCount(): number {
        return this.currentState.touches.length;
    }

    getVirtualThrust(): number {
        return this.currentState.virtualThrust;
    }

    getVirtualRotation(): number {
        return this.currentState.virtualRotation;
    }

    // Game-specific input methods
    getThrustInput(): number {
        if (this.config.enableTouch) {
            return this.currentState.virtualThrust;
        }
        
        let thrust = 0;
        if (this.isKeyDown('ArrowUp') || this.isKeyDown('KeyW')) thrust += 1;
        if (this.isKeyDown('ArrowDown') || this.isKeyDown('KeyS')) thrust -= 1;
        
        // Gamepad input
        for (const gamepad of this.gamepads.values()) {
            if (gamepad.connected && gamepad.axes.length > 1) {
                thrust += -gamepad.axes[1]; // Invert Y axis
            }
        }
        
        return Math.max(-1, Math.min(1, thrust));
    }

    getRotationInput(): number {
        if (this.config.enableTouch) {
            return this.currentState.virtualRotation;
        }
        
        let rotation = 0;
        if (this.isKeyDown('ArrowLeft') || this.isKeyDown('KeyA')) rotation -= 1;
        if (this.isKeyDown('ArrowRight') || this.isKeyDown('KeyD')) rotation += 1;
        
        // Gamepad input
        for (const gamepad of this.gamepads.values()) {
            if (gamepad.connected && gamepad.axes.length > 0) {
                rotation += gamepad.axes[0]; // X axis
            }
        }
        
        return Math.max(-1, Math.min(1, rotation));
    }

    isActionPressed(): boolean {
        return this.isKeyPressed('Space') || 
               this.isMouseButtonPressed(0) || 
               this.currentState.virtualAction;
    }

    isPausePressed(): boolean {
        return this.isKeyPressed('Escape') || this.isKeyPressed('KeyP');
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        // Remove all event listeners
        this.eventListeners.forEach(cleanup => cleanup());
        this.eventListeners = [];
        
        // Clear states
        this.activeTouches.clear();
        this.gamepads.clear();
        
        this.logger.info('🧹 Input manager cleanup completed');
    }
}

// Helper interfaces
interface TouchZone {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'button' | 'joystick';
}

interface TouchInfo {
    id: number;
    startPosition: Vector2;
    currentPosition: Vector2;
    zone: string | null;
}