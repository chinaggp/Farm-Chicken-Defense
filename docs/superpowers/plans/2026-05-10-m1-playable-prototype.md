# M1 Playable Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable M1 Cocos Creator 3.8.8 horizontal prototype with three local levels, one-line defense drawing, chickens, eagle attacks, win/lose flow, and farm-style HUD.

**Architecture:** Implement a compact set of TypeScript modules under `assets/scripts` plus JSON config under `assets/resources/config`. The main `M1PrototypeRoot` component creates runtime nodes programmatically so the empty Cocos project can become playable without manually authored prefabs. Platform and ad code remains mock-only.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos 2D nodes, `Graphics`, `Label`, JSON resource files.

---

## File Structure

- Create `assets/scripts/config/GameTypes.ts`: shared enums and interfaces.
- Create `assets/scripts/config/M1LevelConfigs.ts`: three fallback level definitions and balance constants.
- Create `assets/scripts/gameplay/Geometry.ts`: vector and segment collision helpers.
- Create `assets/scripts/services/MockAdService.ts`: mock ad interface for future Douyin replacement.
- Create `assets/scripts/M1PrototypeRoot.ts`: root Cocos component, runtime scene creation, input, movement, collisions, UI, and level flow.
- Create `assets/resources/config/game_balance.json`: balance values matching fallback constants.
- Create `assets/resources/config/levels/level_001.json`, `level_002.json`, `level_003.json`: test level data.

## Task 1: Config, Types, And Geometry

**Files:**
- Create: `assets/scripts/config/GameTypes.ts`
- Create: `assets/scripts/config/M1LevelConfigs.ts`
- Create: `assets/scripts/gameplay/Geometry.ts`
- Create: `assets/resources/config/game_balance.json`
- Create: `assets/resources/config/levels/level_001.json`
- Create: `assets/resources/config/levels/level_002.json`
- Create: `assets/resources/config/levels/level_003.json`

- [ ] **Step 1: Add shared TypeScript types**

Create `GameTypes.ts` with interfaces for levels, actors, obstacles, defense lines, and game state.

- [ ] **Step 2: Add three fallback levels**

Create `M1LevelConfigs.ts` with three levels: one basic level, one obstacle level, and one two-chicken level. Use a 1280x720 play area and durations between 20 and 30 seconds.

- [ ] **Step 3: Add geometry helpers**

Create `Geometry.ts` with distance, clamp, segment intersection, closest point, and circle-to-segment helpers used by chickens and eagles.

- [ ] **Step 4: Add JSON config mirrors**

Create the balance and level JSON files so later resource loading can consume the same data.

- [ ] **Step 5: Verify TypeScript syntax**

Run `npx tsc --noEmit` if available, or use the project-local generated Cocos TypeScript config through `tsc --noEmit`. Expected result: no syntax errors in the new config and helper modules.

## Task 2: Runtime Prototype Scene

**Files:**
- Create: `assets/scripts/M1PrototypeRoot.ts`
- Create: `assets/scripts/services/MockAdService.ts`

- [ ] **Step 1: Add mock ad service**

Create `MockAdService.ts` with `init`, `showRewardVideo`, and `showInterstitial`, each safe to call without AppID.

- [ ] **Step 2: Add root component shell**

Create `M1PrototypeRoot.ts` as a Cocos component that initializes a 1280x720 horizontal playfield, loads fallback levels, and creates background, actors, defense graphics, and UI nodes.

- [ ] **Step 3: Implement drawing**

Handle touch start, move, and end. Allow exactly one defense line per round. Filter points by minimum draw distance and limit total draw length.

- [ ] **Step 4: Implement chicken and eagle runtime**

Move chickens randomly with bounce behavior. Move eagles through patrol, lock, dive, and recover states. Detect defense-line blocking through segment collision helpers.

- [ ] **Step 5: Implement win/lose and level flow**

Countdown to win when all chickens survive. Lose immediately if any chicken is hit or leaves bounds. Provide retry and next-level button handlers.

- [ ] **Step 6: Implement farm-style HUD**

Use wood-colored panels, high-saturation green/orange buttons, large labels, and star/result indicators aligned to the visual reference.

- [ ] **Step 7: Verify TypeScript and editor attachment path**

Run TypeScript verification. If shell preview is unavailable, document that `M1PrototypeRoot` must be attached to a root node in a Cocos scene for preview.
