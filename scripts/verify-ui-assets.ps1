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
  'ui/button_pause.png',
  'ui/button_restart.png',
  'ui/countdown_panel_8_5.png',
  'ui/icon_clock.png',
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
  'ui-assets/ui/button_pause/spriteFrame',
  'ui-assets/ui/button_restart/spriteFrame',
  'ui-assets/ui/countdown_panel_8_5/spriteFrame',
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

Write-Output 'UI asset wiring verification passed.'
