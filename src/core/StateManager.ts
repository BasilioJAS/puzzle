import { GameState, Scene } from '../types/GameTypes';

export class StateManager {
    private currentState: GameState = GameState.Boot;
    private scenes: Map<GameState, Scene> = new Map();
    private ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    registerScene(state: GameState, scene: Scene): void {
        this.scenes.set(state, scene);
    }

    getCurrentState(): GameState {
        return this.currentState;
    }

    getScene(state: GameState): Scene | undefined {
        return this.scenes.get(state);
    }

    changeState(newState: GameState): void {
        const oldScene = this.scenes.get(this.currentState);
        if (oldScene) oldScene.exit();

        this.currentState = newState;

        const newScene = this.scenes.get(newState);
        if (newScene) newScene.enter(this.ctx);
    }

    update(dt: number): void {
        const scene = this.scenes.get(this.currentState);
        if (scene) scene.update(dt);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const scene = this.scenes.get(this.currentState);
        if (scene) scene.render(ctx);
    }
}
