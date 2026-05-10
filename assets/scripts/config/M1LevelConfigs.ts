import type { GameBalanceConfig, M1LevelConfig } from './GameTypes';

export const DEFAULT_GAME_BALANCE: GameBalanceConfig = {
  playArea: {
    width: 1280,
    height: 720,
    padding: 56,
  },
  line: {
    minSampleDistance: 18,
    maxLength: 520,
    collisionRadius: 18,
  },
  chicken: {
    radius: 24,
    minSpeed: 95,
    maxSpeed: 150,
    bounceCooldown: 0.18,
  },
  eagle: {
    radius: 30,
    patrolSpeed: 125,
    lockDuration: 0.75,
    diveSpeed: 430,
    recoverDuration: 1.1,
    hitRadius: 36,
  },
};

export const M1_LEVEL_CONFIGS: M1LevelConfig[] = [
  {
    id: 'level_001',
    title: 'Sunny Fence',
    duration: 20,
    chickens: [{ position: { x: -250, y: -95 } }],
    eagle: {
      position: { x: 0, y: 245 },
      patrolMinX: -420,
      patrolMaxX: 420,
    },
    obstacles: [],
  },
  {
    id: 'level_002',
    title: 'Hay Bale',
    duration: 24,
    chickens: [{ position: { x: -310, y: -95 } }],
    eagle: {
      position: { x: -260, y: 250 },
      patrolMinX: -470,
      patrolMaxX: 470,
    },
    obstacles: [
      {
        id: 'hay_bale_01',
        position: { x: 90, y: -55 },
        size: { x: 170, y: 86 },
      },
    ],
  },
  {
    id: 'level_003',
    title: 'Busy Yard',
    duration: 28,
    chickens: [
      { position: { x: -360, y: -120 } },
      { position: { x: 350, y: -145 } },
    ],
    eagle: {
      position: { x: 300, y: 255 },
      patrolMinX: -500,
      patrolMaxX: 500,
    },
    obstacles: [],
  },
];

export function getM1LevelConfig(index: number): M1LevelConfig {
  const safeIndex = Math.max(0, Math.min(index, M1_LEVEL_CONFIGS.length - 1));
  return M1_LEVEL_CONFIGS[safeIndex];
}
