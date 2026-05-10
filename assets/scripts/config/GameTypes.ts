export interface Vec2Like {
  x: number;
  y: number;
}

export type EagleState = 'patrol' | 'lock' | 'dive' | 'recover';
export type GameState = 'ready' | 'playing' | 'paused' | 'win' | 'lose';

export interface DrawLineBalance {
  minSampleDistance: number;
  collisionRadius: number;
}

export interface ChickenBalance {
  radius: number;
  minSpeed: number;
  maxSpeed: number;
  bounceCooldown: number;
}

export interface EagleBalance {
  radius: number;
  patrolSpeed: number;
  lockDuration: number;
  diveSpeed: number;
  recoverDuration: number;
  hitRadius: number;
}

export interface GameBalanceConfig {
  playArea: {
    width: number;
    height: number;
    padding: number;
    chickenAreaTopY: number;
  };
  line: DrawLineBalance;
  chicken: ChickenBalance;
  eagle: EagleBalance;
}

export interface ChickenSpawnConfig {
  position: Vec2Like;
}

export interface EagleSpawnConfig {
  position: Vec2Like;
  patrolMinX: number;
  patrolMaxX: number;
}

export interface ObstacleConfig {
  id: string;
  position: Vec2Like;
  size: Vec2Like;
}

export interface M1LevelConfig {
  id: string;
  title: string;
  duration: number;
  chickens: ChickenSpawnConfig[];
  eagle: EagleSpawnConfig;
  obstacles: ObstacleConfig[];
}

export interface RuntimeChicken {
  node: import('cc').Node;
  position: import('cc').Vec2;
  velocity: import('cc').Vec2;
  alive: boolean;
  bounceCooldownLeft: number;
  radius: number;
}

export interface RuntimeEagle {
  node: import('cc').Node;
  position: import('cc').Vec2;
  velocity: import('cc').Vec2;
  state: EagleState;
  stateTimer: number;
  patrolDirection: number;
  targetChickenIndex: number;
  radius: number;
}
