$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$resourceRoot = Join-Path $root 'assets/resources/ui-assets'
$scriptPath = Join-Path $root 'assets/scripts/M1PrototypeRoot.ts'

$requiredFiles = @(
  'background/bg_farm_level_01.png',
  'chick/chick_idle_01.png',
  'chick/chick_run_01.png',
  'chick/chick_hit_01.png',
  'chick/chick_victory_01.png',
  'enemy/eagle_fly_01.png',
  'enemy/eagle_dive_01.png',
  'enemy/eagle_blocked_01.png',
  'defense/vine_texture.png',
  'ui/countdown_panel_generated.png',
  'guide/hand_pointer.png'
)

$missingFiles = @()
foreach ($relativePath in $requiredFiles) {
  $fullPath = Join-Path $resourceRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    $missingFiles += $relativePath
  }
}

if ($missingFiles.Count -gt 0) {
  throw "Missing UI asset files under assets/resources/ui-assets: $($missingFiles -join ', ')"
}

$source = Get-Content -LiteralPath $scriptPath -Raw
$requiredMarkers = @(
  'SpriteFrame',
  'ui-assets/background/bg_farm_level_01/spriteFrame',
  'ui-assets/chick/chick_idle_01/spriteFrame',
  'ui-assets/enemy/eagle_fly_01/spriteFrame',
  'ui-assets/ui/countdown_panel_generated/spriteFrame',
  'CountdownValue',
  'CountdownUnit',
  'formatCountdownValue',
  'new Vec2(-493, 256)',
  'new Vec2(300, 127)',
  'applyCountdownTextStyle',
  'HudButtonSkin',
  'PauseIcon',
  'RestartIcon',
  'drawHudButtonIcon',
  'ui-assets/defense/vine_texture/spriteFrame'
)

$missingMarkers = @()
foreach ($marker in $requiredMarkers) {
  if (-not $source.Contains($marker)) {
    $missingMarkers += $marker
  }
}

if ($missingMarkers.Count -gt 0) {
  throw "Missing UI asset code markers in M1PrototypeRoot.ts: $($missingMarkers -join ', ')"
}

$forbiddenMarkers = @(
  'countdown_panel_8_5',
  'Chicks ${aliveCount}',
  'ChickenBadge'
)

$presentForbiddenMarkers = @()
foreach ($marker in $forbiddenMarkers) {
  if ($source.Contains($marker)) {
    $presentForbiddenMarkers += $marker
  }
}

if ($presentForbiddenMarkers.Count -gt 0) {
  throw "Countdown HUD must render runtime text, but static countdown art is still referenced: $($presentForbiddenMarkers -join ', ')"
}

Write-Output 'UI asset wiring verification passed.'
