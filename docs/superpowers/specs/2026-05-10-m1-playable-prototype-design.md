# M1 Playable Prototype Design

## Goal

Build the first playable horizontal Cocos Creator 3.8.8 prototype for Farm Chicken Defense. The prototype validates the main risk areas before making 30 levels: one-line drawing, chicken movement, eagle attack, defense blocking, win/lose flow, and farm-style HUD.

## Scope

M1 includes three local test levels, one gameplay scene controller, lightweight generated runtime visuals, local state only, and mock advertising services. It does not include real Douyin AppID, real ad unit IDs, final AI art, 30 production levels, cloud services, account login, leaderboard, or level editor.

## Gameplay Rules

The game uses a fixed horizontal 1280x720 design baseline. Each round allows exactly one drawn defense line. Chickens move randomly and bounce away when they touch the defense line, static obstacles, or map bounds. Eagles patrol, lock the nearest live chicken, dive toward it, and recover after either reaching the target area or being blocked by the defense line. When blocked, the eagle returns to patrol and later chooses another attack direction; M1 does not implement full pathfinding.

All chickens must survive until the timer reaches zero. If any chicken is hit by an eagle or leaves the safe play area, the round fails. Three test levels are used: level 1 has one chicken and one eagle, level 2 adds a simple obstacle, and level 3 has two chickens and one eagle.

## Architecture

Runtime code is split into small Cocos components and pure data modules:

- `config`: level definitions and balance values.
- `core`: game state, round flow, and level loading.
- `gameplay`: chicken, eagle, drawing, defense line, and collision helpers.
- `ui`: HUD, result panel, and visual styling helpers.
- `services`: mock ad and local storage interfaces for later Douyin replacement.

The first implementation favors a working scene controller over premature abstractions. It still keeps platform services behind interfaces so real Douyin APIs can replace mock services later.

## UI Direction

UI follows the Q-style cartoon farm reference: high saturation, rounded shapes, wood panels, green grass accents, orange reward buttons, star icons, and oversized touch targets. M1 may use Cocos `Graphics`, `Label`, and generated primitive nodes instead of final bitmap art, but colors, sizing, and layout should match the intended style.

HUD requirements:

- Top-left wood panel showing level number and countdown.
- Top-right pause/restart controls.
- Bottom panel showing drawing state and remaining line allowance.
- Center result panel for win or lose with retry and next-level actions.

## Config Data

Levels live under `assets/resources/config/levels`. Balance data lives under `assets/resources/config/game_balance.json`. M1 also includes TypeScript fallback level definitions so the prototype can run even if resource loading is not wired in the editor yet.

## Verification

At minimum, TypeScript must compile with the Cocos generated `tsconfig`. If Cocos CLI preview is unavailable from the shell, the remaining verification is opening the project in Cocos Creator 3.8.8, attaching the bootstrap component to the main scene, and previewing level 1 through level 3.
