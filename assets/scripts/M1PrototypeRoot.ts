import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  Node,
  resources,
  JsonAsset,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import { DEFAULT_GAME_BALANCE, getM1LevelConfig, M1_LEVEL_CONFIGS } from './config/M1LevelConfigs';
import type { GameBalanceConfig, GameState, M1LevelConfig, ObstacleConfig, RuntimeChicken, RuntimeEagle } from './config/GameTypes';
import {
  circleTouchesPolyline,
  clamp,
  distance,
  normalizeOrFallback,
  randomRange,
  reflectVelocity,
} from './gameplay/Geometry';
import { MockAdService } from './services/MockAdService';

const { ccclass } = _decorator;

const UI_ASSET_PATHS = {
  background: 'ui-assets/background/bg_farm_level_01/spriteFrame',
  chickenIdle: 'ui-assets/chick/chick_idle_01/spriteFrame',
  chickenHit: 'ui-assets/chick/chick_hit_01/spriteFrame',
  chickenVictory: 'ui-assets/chick/chick_victory_01/spriteFrame',
  eagleFly: 'ui-assets/enemy/eagle_fly_01/spriteFrame',
  eagleDive: 'ui-assets/enemy/eagle_dive_01/spriteFrame',
  eagleBlocked: 'ui-assets/enemy/eagle_blocked_01/spriteFrame',
  vineTexture: 'ui-assets/defense/vine_texture/spriteFrame',
  countdownPanelGenerated: 'ui-assets/ui/countdown_panel_generated/spriteFrame',
  handPointer: 'ui-assets/guide/hand_pointer/spriteFrame',
} as const;

@ccclass('M1PrototypeRoot')
export class M1PrototypeRoot extends Component {
  private balance: GameBalanceConfig = DEFAULT_GAME_BALANCE;
  private levelIndex = 0;
  private levelConfig: M1LevelConfig = getM1LevelConfig(0);
  private state: GameState = 'ready';
  private timeLeft = 0;
  private chickens: RuntimeChicken[] = [];
  private eagle: RuntimeEagle | null = null;
  private linePoints: Vec2[] = [];
  private isDrawing = false;
  private lineCommitted = false;
  private resultActionPending = false;

  private backgroundSprite: Sprite | null = null;
  private backgroundSkinReady = false;
  private backgroundGraphics: Graphics | null = null;
  private lineGraphics: Graphics | null = null;
  private vineSegmentNodes: Node[] = [];
  private hudLabel: Label | null = null;
  private countdownValueLabel: Label | null = null;
  private countdownUnitLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private resultPanel: Node | null = null;
  private resultTitle: Label | null = null;
  private resultButton: Node | null = null;
  private resultButtonLabel: Label | null = null;
  private pauseButton: Node | null = null;
  private restartButton: Node | null = null;

  protected onLoad(): void {
    MockAdService.init();
    this.prepareRootTransform();
    this.createScene();
    this.bindTouchEvents();
    this.loadExternalConfig();
    this.startLevel(0);
  }

  protected onDestroy(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    this.pauseButton?.off(Node.EventType.TOUCH_END, this.onPauseButton, this);
    this.restartButton?.off(Node.EventType.TOUCH_END, this.onRestartButton, this);
    this.resultButton?.off(Node.EventType.TOUCH_END, this.onResultButton, this);
  }

  protected update(deltaTime: number): void {
    if (this.state !== 'playing') {
      return;
    }

    this.timeLeft = Math.max(0, this.timeLeft - deltaTime);
    this.updateChickens(deltaTime);
    this.updateEagle(deltaTime);
    this.updateHud();

    if (this.state === 'playing' && this.timeLeft <= 0 && this.chickens.every((chicken) => chicken.alive)) {
      this.finishGame(true);
    }
  }

  private prepareRootTransform(): void {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }
    transform.setContentSize(this.balance.playArea.width, this.balance.playArea.height);
    transform.setAnchorPoint(0.5, 0.5);
    this.backgroundSprite?.node.getComponent(UITransform)?.setContentSize(this.balance.playArea.width, this.balance.playArea.height);
  }

  private bindTouchEvents(): void {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private loadExternalConfig(): void {
    resources.load('config/game_balance', JsonAsset, (error, asset) => {
      if (!error && asset?.json) {
        this.balance = asset.json as GameBalanceConfig;
        this.prepareRootTransform();
        this.redrawBackground();
        if (this.state === 'playing') {
          this.startLevel(this.levelIndex);
        }
      }
    });
  }

  private createScene(): void {
    this.backgroundSprite = this.createFullStageSprite('BackgroundSkin', UI_ASSET_PATHS.background, -12, () => {
      this.backgroundSkinReady = true;
      this.redrawBackground();
    });
    this.backgroundGraphics = this.createGraphicsNode('Background', -10);
    this.lineGraphics = this.createGraphicsNode('DefenseLine', 10);

    this.hudLabel = this.createLabel('HUD', '', new Vec2(-560, 315), 24, new Color(102, 62, 28, 255));
    this.hintLabel = this.createLabel('Hint', '', new Vec2(0, -318), 22, new Color(72, 120, 42, 255));

    this.createHudControls();
    this.createResultPanel();
    this.redrawBackground();
  }

  private createFullStageSprite(name: string, resourcePath: string, siblingIndex: number, onLoaded?: () => void): Sprite {
    const node = new Node(name);
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.setSiblingIndex(siblingIndex);
    node.addComponent(UITransform).setContentSize(this.balance.playArea.width, this.balance.playArea.height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(resourcePath, sprite, onLoaded);
    return sprite;
  }

  private loadSpriteFrame(resourcePath: string, sprite: Sprite, onLoaded?: () => void): void {
    resources.load(resourcePath, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame || !sprite?.node?.isValid) {
        return;
      }

      sprite.spriteFrame = spriteFrame;
      onLoaded?.();
    });
  }

  private createGraphicsNode(name: string, siblingIndex: number): Graphics {
    const node = new Node(name);
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.setSiblingIndex(siblingIndex);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.balance.playArea.width, this.balance.playArea.height);
    return node.addComponent(Graphics);
  }

  private createLabel(name: string, text: string, position: Vec2, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    this.node.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(520, 60);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    return label;
  }

  private createSpriteChild(parent: Node, name: string, resourcePath: string, size: Vec2, position = new Vec2(0, 0)): Sprite {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(resourcePath, sprite);
    return sprite;
  }

  private createSpriteNode(name: string, resourcePath: string, position: Vec2, size: Vec2, siblingIndex?: number): Sprite {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    this.node.addChild(node);
    if (siblingIndex !== undefined) {
      node.setSiblingIndex(siblingIndex);
    }
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(resourcePath, sprite);
    return sprite;
  }

  private createHudControls(): void {
    if (this.hudLabel?.node) {
      const hudIndex = this.hudLabel.node.getSiblingIndex();
      const panel = this.createCountdownPanel(new Vec2(-493, 256), new Vec2(300, 127), hudIndex);
      this.countdownValueLabel = this.createPanelLabel(panel, 'CountdownValue', '', new Vec2(-12, -28), new Vec2(132, 62), 52, new Color(205, 44, 12, 255));
      this.countdownUnitLabel = this.createPanelLabel(panel, 'CountdownUnit', '\u79d2', new Vec2(62, -30), new Vec2(42, 36), 26, new Color(48, 27, 9, 255));
      this.applyCountdownTextStyle(this.countdownValueLabel, new Color(255, 228, 142, 255), 3);
      this.applyCountdownTextStyle(this.countdownUnitLabel, new Color(255, 232, 158, 255), 2);
      this.hudLabel.node.active = false;
    }

    this.pauseButton = this.createTopRightButton('PauseButton', new Vec2(488, 286), new Vec2(76, 76));
    this.pauseButton.on(Node.EventType.TOUCH_END, this.onPauseButton, this);

    this.restartButton = this.createTopRightButton('RestartButton', new Vec2(580, 286), new Vec2(76, 76));
    this.restartButton.on(Node.EventType.TOUCH_END, this.onRestartButton, this);
  }

  private createCountdownPanel(position: Vec2, size: Vec2, siblingIndex: number): Node {
    const node = new Node('CountdownPanel');
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    this.node.addChild(node);
    node.setSiblingIndex(siblingIndex);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    this.createSpriteChild(node, 'CountdownPanelGeneratedSkin', UI_ASSET_PATHS.countdownPanelGenerated, size);
    return node;
  }

  private createPanelLabel(parent: Node, name: string, text: string, position: Vec2, size: Vec2, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = color;
    return label;
  }

  private applyCountdownTextStyle(label: Label, color: Color, width: number): void {
    const outline = label.node.addComponent(LabelOutline);
    outline.color = color;
    outline.width = width;
  }

  private createTopRightButton(name: string, position: Vec2, size: Vec2): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    this.createHudButtonSkin(node, size);
    this.drawHudButtonIcon(node, name === 'PauseButton' ? 'PauseIcon' : 'RestartIcon');
    return node;
  }

  private createHudButtonSkin(parent: Node, size: Vec2): void {
    const node = new Node('HudButtonSkin');
    node.layer = this.node.layer;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    const graphics = node.addComponent(Graphics);
    const radius = Math.min(size.x, size.y) * 0.5;

    graphics.fillColor = new Color(126, 74, 30, 255);
    graphics.circle(0, 0, radius);
    graphics.fill();

    graphics.fillColor = new Color(255, 218, 129, 255);
    graphics.circle(0, 0, radius - 6);
    graphics.fill();

    graphics.strokeColor = new Color(116, 65, 25, 255);
    graphics.lineWidth = 4;
    graphics.circle(0, 0, radius - 9);
    graphics.stroke();

    graphics.strokeColor = new Color(255, 244, 198, 185);
    graphics.lineWidth = 3;
    graphics.moveTo(-radius * 0.48, radius * 0.28);
    graphics.lineTo(radius * 0.18, radius * 0.46);
    graphics.stroke();
  }

  private drawHudButtonIcon(parent: Node, iconName: 'PauseIcon' | 'RestartIcon'): void {
    const node = new Node(iconName);
    node.layer = this.node.layer;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(44, 44);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(100, 55, 22, 255);
    graphics.strokeColor = new Color(100, 55, 22, 255);
    graphics.lineWidth = 8;

    if (iconName === 'PauseIcon') {
      graphics.rect(-13, -18, 8, 36);
      graphics.rect(5, -18, 8, 36);
      graphics.fill();
      return;
    }

    graphics.circle(0, 0, 16);
    graphics.stroke();
    graphics.moveTo(14, 15);
    graphics.lineTo(24, 16);
    graphics.lineTo(18, 6);
    graphics.fill();
  }

  private createResultPanel(): void {
    const panel = new Node('ResultPanel');
    panel.layer = this.node.layer;
    panel.setPosition(0, 0, 0);
    this.node.addChild(panel);
    panel.addComponent(UITransform).setContentSize(420, 250);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.fillColor = new Color(236, 176, 84, 245);
    panelGraphics.strokeColor = new Color(116, 73, 36, 255);
    panelGraphics.lineWidth = 8;
    panelGraphics.rect(-210, -125, 420, 250);
    panelGraphics.fill();
    panelGraphics.stroke();

    this.resultTitle = this.createChildLabel(panel, 'ResultTitle', '', new Vec2(0, 55), 36, new Color(78, 45, 24, 255));
    this.resultButton = new Node('ResultButton');
    this.resultButton.layer = this.node.layer;
    this.resultButton.setPosition(0, -55, 0);
    panel.addChild(this.resultButton);
    this.resultButton.addComponent(UITransform).setContentSize(230, 70);
    const buttonGraphics = this.resultButton.addComponent(Graphics);
    buttonGraphics.fillColor = new Color(86, 178, 79, 255);
    buttonGraphics.strokeColor = new Color(41, 102, 48, 255);
    buttonGraphics.lineWidth = 5;
    buttonGraphics.rect(-115, -35, 230, 70);
    buttonGraphics.fill();
    buttonGraphics.stroke();
    this.resultButtonLabel = this.createChildLabel(this.resultButton, 'ResultButtonLabel', '', new Vec2(0, -12), 26, Color.WHITE);
    this.resultButton.on(Node.EventType.TOUCH_END, this.onResultButton, this);

    this.resultPanel = panel;
    this.resultPanel.active = false;
  }

  private createChildLabel(parent: Node, name: string, text: string, position: Vec2, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(360, 58);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    return label;
  }

  private startLevel(index: number): void {
    this.levelIndex = clamp(index, 0, M1_LEVEL_CONFIGS.length - 1);
    this.levelConfig = getM1LevelConfig(this.levelIndex);
    this.state = 'playing';
    this.timeLeft = this.levelConfig.duration;
    this.linePoints = [];
    this.isDrawing = false;
    this.lineCommitted = false;
    this.resultActionPending = false;
    this.clearActors();
    this.spawnChickens();
    this.spawnEagle();
    this.redrawBackground();
    this.redrawLine();
    this.updateHud();
    this.updateHint();
    if (this.resultPanel) {
      this.resultPanel.active = false;
    }
  }

  private clearActors(): void {
    for (const chicken of this.chickens) {
      chicken.node.destroy();
    }
    this.chickens = [];
    if (this.eagle) {
      this.eagle.node.destroy();
      this.eagle = null;
    }
  }

  private spawnChickens(): void {
    for (const spawn of this.levelConfig.chickens) {
      const node = this.createChickenNode();
      const speed = randomRange(this.balance.chicken.minSpeed, this.balance.chicken.maxSpeed);
      const angle = randomRange(0, Math.PI * 2);
      const velocity = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
      node.setPosition(spawn.position.x, spawn.position.y, 0);
      this.chickens.push({
        node,
        position: new Vec2(spawn.position.x, spawn.position.y),
        velocity,
        alive: true,
        bounceCooldownLeft: 0,
        radius: this.balance.chicken.radius,
      });
    }
  }

  private spawnEagle(): void {
    const node = this.createEagleNode();
    const spawn = this.levelConfig.eagle;
    node.setPosition(spawn.position.x, spawn.position.y, 0);
    this.eagle = {
      node,
      position: new Vec2(spawn.position.x, spawn.position.y),
      velocity: new Vec2(this.balance.eagle.patrolSpeed, 0),
      state: 'patrol',
      stateTimer: 0,
      patrolDirection: 1,
      targetChickenIndex: -1,
      radius: this.balance.eagle.radius,
    };
  }

  private createChickenNode(): Node {
    const node = new Node('Chicken');
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(this.balance.chicken.radius * 3.4, this.balance.chicken.radius * 3.4);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(255, 232, 96, 255);
    graphics.strokeColor = new Color(210, 128, 40, 255);
    graphics.lineWidth = 4;
    graphics.circle(0, 0, this.balance.chicken.radius);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(255, 125, 68, 255);
    graphics.circle(18, 0, 7);
    graphics.fill();
    graphics.fillColor = Color.BLACK;
    graphics.circle(7, 8, 3);
    graphics.fill();
    this.createActorShadow(node, new Vec2(62, 16), new Vec2(0, -30), new Color(90, 60, 28, 72));
    const spriteNode = new Node('ChickenSkin');
    spriteNode.layer = this.node.layer;
    node.addChild(spriteNode);
    spriteNode.setPosition(0, 2, 0);
    spriteNode.addComponent(UITransform).setContentSize(this.balance.chicken.radius * 3.05, this.balance.chicken.radius * 3.35);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(UI_ASSET_PATHS.chickenIdle, sprite, () => graphics.clear());
    return node;
  }

  private createEagleNode(): Node {
    const node = new Node('Eagle');
    node.layer = this.node.layer;
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(this.balance.eagle.radius * 4.2, this.balance.eagle.radius * 3.2);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(118, 78, 49, 255);
    graphics.strokeColor = new Color(67, 46, 33, 255);
    graphics.lineWidth = 4;
    graphics.ellipse(0, 0, 34, 22);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(250, 236, 190, 255);
    graphics.circle(18, 10, 13);
    graphics.fill();
    graphics.fillColor = new Color(236, 178, 48, 255);
    graphics.moveTo(30, 8);
    graphics.lineTo(48, 2);
    graphics.lineTo(30, -4);
    graphics.close();
    graphics.fill();
    this.createActorShadow(node, new Vec2(88, 16), new Vec2(0, -34), new Color(78, 54, 34, 38));
    const spriteNode = new Node('EagleSkin');
    spriteNode.layer = this.node.layer;
    node.addChild(spriteNode);
    spriteNode.addComponent(UITransform).setContentSize(this.balance.eagle.radius * 4.3, this.balance.eagle.radius * 3.35);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(UI_ASSET_PATHS.eagleFly, sprite, () => graphics.clear());
    return node;
  }

  private createActorShadow(parent: Node, size: Vec2, position: Vec2, color: Color): void {
    const node = new Node('ActorShadow');
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size.x, size.y);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.ellipse(0, 0, size.x * 0.5, size.y * 0.5);
    graphics.fill();
  }

  private updateChickens(deltaTime: number): void {
    const playBounds = this.getBounds();
    const movementBounds = this.getChickenBounds();
    for (const chicken of this.chickens) {
      if (!chicken.alive) {
        continue;
      }

      chicken.bounceCooldownLeft = Math.max(0, chicken.bounceCooldownLeft - deltaTime);
      chicken.position.x += chicken.velocity.x * deltaTime;
      chicken.position.y += chicken.velocity.y * deltaTime;

      if (
        chicken.position.x < playBounds.minX
        || chicken.position.x > playBounds.maxX
        || chicken.position.y < playBounds.minY
        || chicken.position.y > playBounds.maxY
      ) {
        this.finishGame(false);
        return;
      }

      if (chicken.position.x - chicken.radius < movementBounds.minX || chicken.position.x + chicken.radius > movementBounds.maxX) {
        chicken.velocity.x *= -1;
        chicken.position.x = clamp(chicken.position.x, movementBounds.minX + chicken.radius, movementBounds.maxX - chicken.radius);
      }
      if (chicken.position.y - chicken.radius < movementBounds.minY || chicken.position.y + chicken.radius > movementBounds.maxY) {
        chicken.velocity.y *= -1;
        chicken.position.y = clamp(chicken.position.y, movementBounds.minY + chicken.radius, movementBounds.maxY - chicken.radius);
      }

      const lineHit = chicken.bounceCooldownLeft <= 0
        ? circleTouchesPolyline(chicken.position, chicken.radius + this.balance.line.collisionRadius, this.linePoints)
        : null;
      if (lineHit) {
        chicken.velocity = reflectVelocity(chicken.velocity, lineHit.normal);
        chicken.position.x += lineHit.normal.x * 12;
        chicken.position.y += lineHit.normal.y * 12;
        chicken.bounceCooldownLeft = this.balance.chicken.bounceCooldown;
      }

      const obstacleHit = chicken.bounceCooldownLeft <= 0 ? this.circleTouchesObstacle(chicken.position, chicken.radius) : null;
      if (obstacleHit) {
        chicken.velocity = reflectVelocity(chicken.velocity, obstacleHit.normal);
        chicken.position.x += obstacleHit.normal.x * 14;
        chicken.position.y += obstacleHit.normal.y * 14;
        chicken.bounceCooldownLeft = this.balance.chicken.bounceCooldown;
      }

      chicken.node.setPosition(chicken.position.x, chicken.position.y, 0);
    }
  }

  private updateEagle(deltaTime: number): void {
    if (!this.eagle) {
      return;
    }

    const eagle = this.eagle;
    eagle.stateTimer += deltaTime;

    if (eagle.state === 'patrol') {
      this.updateEaglePatrol(eagle, deltaTime);
      const targetIndex = this.findNearestChickenIndex(eagle.position);
      if (targetIndex >= 0 && eagle.stateTimer > 1.2) {
        eagle.state = 'lock';
        eagle.stateTimer = 0;
        eagle.targetChickenIndex = targetIndex;
      }
    } else if (eagle.state === 'lock') {
      if (eagle.stateTimer >= this.balance.eagle.lockDuration) {
        this.startEagleDive(eagle);
      }
    } else if (eagle.state === 'dive') {
      this.updateEagleDive(eagle, deltaTime);
    } else if (eagle.state === 'recover') {
      eagle.position.y += this.balance.eagle.patrolSpeed * 1.4 * deltaTime;
      if (eagle.stateTimer >= this.balance.eagle.recoverDuration || eagle.position.y >= this.levelConfig.eagle.position.y) {
        eagle.state = 'patrol';
        eagle.stateTimer = 0;
        eagle.position.y = this.levelConfig.eagle.position.y;
        eagle.velocity = new Vec2(this.balance.eagle.patrolSpeed * eagle.patrolDirection, 0);
      }
    }

    eagle.node.setPosition(eagle.position.x, eagle.position.y, 0);
  }

  private updateEaglePatrol(eagle: RuntimeEagle, deltaTime: number): void {
    const spawn = this.levelConfig.eagle;
    eagle.position.x += this.balance.eagle.patrolSpeed * eagle.patrolDirection * deltaTime;
    if (eagle.position.x <= spawn.patrolMinX) {
      eagle.position.x = spawn.patrolMinX;
      eagle.patrolDirection = 1;
    } else if (eagle.position.x >= spawn.patrolMaxX) {
      eagle.position.x = spawn.patrolMaxX;
      eagle.patrolDirection = -1;
    }
  }

  private startEagleDive(eagle: RuntimeEagle): void {
    const target = this.chickens[eagle.targetChickenIndex];
    if (!target || !target.alive) {
      eagle.state = 'recover';
      eagle.stateTimer = 0;
      return;
    }

    eagle.velocity = normalizeOrFallback(new Vec2(target.position.x - eagle.position.x, target.position.y - eagle.position.y), new Vec2(0, -1));
    eagle.velocity.multiplyScalar(this.balance.eagle.diveSpeed);
    eagle.state = 'dive';
    eagle.stateTimer = 0;
  }

  private updateEagleDive(eagle: RuntimeEagle, deltaTime: number): void {
    const lastPosition = eagle.position.clone();
    eagle.position.x += eagle.velocity.x * deltaTime;
    eagle.position.y += eagle.velocity.y * deltaTime;

    const lineHit = circleTouchesPolyline(eagle.position, eagle.radius + this.balance.line.collisionRadius, this.linePoints);
    const obstacleHit = this.circleTouchesObstacle(eagle.position, eagle.radius);
    if (lineHit || obstacleHit || this.segmentCrossesLine(lastPosition, eagle.position) || this.segmentCrossesObstacle(lastPosition, eagle.position)) {
      eagle.state = 'recover';
      eagle.stateTimer = 0;
      eagle.velocity = new Vec2(0, this.balance.eagle.patrolSpeed);
      return;
    }

    for (const chicken of this.chickens) {
      if (chicken.alive && distance(eagle.position, chicken.position) <= this.balance.eagle.hitRadius + chicken.radius) {
        chicken.alive = false;
        this.finishGame(false);
        return;
      }
    }

    const bounds = this.getBounds();
    if (eagle.position.y < bounds.minY - 80 || eagle.position.x < bounds.minX - 120 || eagle.position.x > bounds.maxX + 120) {
      eagle.state = 'recover';
      eagle.stateTimer = 0;
    }
  }

  private findNearestChickenIndex(position: Vec2): number {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.chickens.length; i += 1) {
      const chicken = this.chickens[i];
      if (!chicken.alive) {
        continue;
      }
      const candidateDistance = distance(position, chicken.position);
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  private segmentCrossesLine(start: Vec2, end: Vec2): boolean {
    if (this.linePoints.length < 2) {
      return false;
    }

    const mid = new Vec2((start.x + end.x) * 0.5, (start.y + end.y) * 0.5);
    return circleTouchesPolyline(mid, distance(start, end) * 0.5 + this.balance.line.collisionRadius, this.linePoints) !== null;
  }

  private circleTouchesObstacle(center: Vec2, radius: number): { normal: Vec2; obstacle: ObstacleConfig } | null {
    for (const obstacle of this.levelConfig.obstacles) {
      const halfWidth = obstacle.size.x * 0.5;
      const halfHeight = obstacle.size.y * 0.5;
      const minX = obstacle.position.x - halfWidth;
      const maxX = obstacle.position.x + halfWidth;
      const minY = obstacle.position.y - halfHeight;
      const maxY = obstacle.position.y + halfHeight;
      const closestX = clamp(center.x, minX, maxX);
      const closestY = clamp(center.y, minY, maxY);
      const delta = new Vec2(center.x - closestX, center.y - closestY);
      if (delta.length() <= radius) {
        return {
          normal: normalizeOrFallback(delta, this.fallbackObstacleNormal(center, obstacle)),
          obstacle,
        };
      }
    }
    return null;
  }

  private fallbackObstacleNormal(center: Vec2, obstacle: ObstacleConfig): Vec2 {
    const dx = center.x - obstacle.position.x;
    const dy = center.y - obstacle.position.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return new Vec2(dx >= 0 ? 1 : -1, 0);
    }
    return new Vec2(0, dy >= 0 ? 1 : -1);
  }

  private segmentCrossesObstacle(start: Vec2, end: Vec2): boolean {
    const steps = Math.max(2, Math.ceil(distance(start, end) / 24));
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps;
      const point = new Vec2(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio);
      if (this.circleTouchesObstacle(point, this.balance.eagle.radius * 0.6)) {
        return true;
      }
    }
    return false;
  }

  private finishGame(win: boolean): void {
    if (this.state !== 'playing') {
      return;
    }

    this.state = win ? 'win' : 'lose';
    this.isDrawing = false;
    if (this.resultPanel) {
      this.resultPanel.active = true;
    }
    if (this.resultTitle) {
      this.resultTitle.string = win ? 'All Chicks Safe!' : 'The Eagle Got In!';
    }
    this.resultActionPending = false;
    if (this.resultButtonLabel) {
      this.resultButtonLabel.string = win ? (this.levelIndex >= M1_LEVEL_CONFIGS.length - 1 ? 'Replay' : 'Next') : 'Retry';
    }
    if (this.hintLabel) {
      this.hintLabel.string = `${this.getLineAllowanceText()}  ${win ? 'Victory requires every chick to survive' : 'Draw a better vine and try again'}`;
    }
  }

  private onResultButton(event?: EventTouch): void {
    this.stopTouchPropagation(event);
    if (this.resultActionPending) {
      return;
    }

    if (this.state === 'win') {
      this.resultActionPending = true;
      const triggerLevelIndex = this.levelIndex;
      const triggerState = this.state;
      void MockAdService.showRewardVideo('win_next_level')
        .then((allowed) => {
          if (!allowed || this.state !== triggerState || this.levelIndex !== triggerLevelIndex) {
            if (this.state === triggerState && this.levelIndex === triggerLevelIndex) {
              this.resultActionPending = false;
            }
            return;
          }
          const nextIndex = triggerLevelIndex >= M1_LEVEL_CONFIGS.length - 1 ? 0 : triggerLevelIndex + 1;
          this.startLevel(nextIndex);
        })
        .catch(() => {
          if (this.state === triggerState && this.levelIndex === triggerLevelIndex) {
            this.resultActionPending = false;
          }
        });
    } else if (this.state === 'lose') {
      this.resultActionPending = true;
      const triggerLevelIndex = this.levelIndex;
      const triggerState = this.state;
      void MockAdService.showInterstitial('retry_current_level')
        .then((allowed) => {
          if (!allowed || this.state !== triggerState || this.levelIndex !== triggerLevelIndex) {
            if (this.state === triggerState && this.levelIndex === triggerLevelIndex) {
              this.resultActionPending = false;
            }
            return;
          }
          this.startLevel(triggerLevelIndex);
        })
        .catch(() => {
          if (this.state === triggerState && this.levelIndex === triggerLevelIndex) {
            this.resultActionPending = false;
          }
        });
    }
  }

  private onPauseButton(event?: EventTouch): void {
    this.stopTouchPropagation(event);
    if (this.state === 'playing') {
      this.state = 'paused';
      this.isDrawing = false;
      this.updateHint();
      return;
    }

    if (this.state === 'paused') {
      this.state = 'playing';
      this.updateHint();
    }
  }

  private onRestartButton(event?: EventTouch): void {
    this.stopTouchPropagation(event);
    this.startLevel(this.levelIndex);
  }

  private onTouchStart(event: EventTouch): void {
    if (this.shouldIgnoreRootTouch(event) || this.state !== 'playing' || this.lineCommitted) {
      return;
    }

    this.isDrawing = true;
    this.linePoints = [this.touchToLocal(event)];
    this.redrawLine();
  }

  private onTouchMove(event: EventTouch): void {
    if (this.shouldIgnoreRootTouch(event) || !this.isDrawing || this.state !== 'playing') {
      return;
    }

    const next = this.touchToLocal(event);
    const last = this.linePoints[this.linePoints.length - 1];
    if (!last || distance(last, next) < this.balance.line.minSampleDistance) {
      return;
    }

    this.linePoints.push(next.clone());
    if (this.linePoints.length >= 2) {
      this.lineCommitted = true;
    }
    this.redrawLine();
    this.updateHint();
  }

  private onTouchEnd(event?: EventTouch): void {
    if (event && this.shouldIgnoreRootTouch(event)) {
      return;
    }

    this.isDrawing = false;
    if (this.linePoints.length < 2) {
      this.linePoints = [];
      this.lineCommitted = false;
      this.redrawLine();
    } else {
      this.lineCommitted = true;
    }
    this.updateHint();
  }

  private shouldIgnoreRootTouch(event: EventTouch): boolean {
    return event.target !== this.node;
  }

  private stopTouchPropagation(event?: EventTouch): void {
    if (!event) {
      return;
    }
    event.propagationStopped = true;
  }

  private touchToLocal(event: EventTouch): Vec2 {
    const uiLocation = event.getUILocation();
    const transform = this.node.getComponent(UITransform);
    if (!transform) {
      return new Vec2(uiLocation.x, uiLocation.y);
    }
    const local = transform.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
    const bounds = this.getBounds();
    return new Vec2(clamp(local.x, bounds.minX, bounds.maxX), clamp(local.y, bounds.minY, bounds.maxY));
  }

  private getBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const halfWidth = this.balance.playArea.width * 0.5 - this.balance.playArea.padding;
    const halfHeight = this.balance.playArea.height * 0.5 - this.balance.playArea.padding;
    return {
      minX: -halfWidth,
      maxX: halfWidth,
      minY: -halfHeight,
      maxY: halfHeight,
    };
  }

  private getChickenBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const bounds = this.getBounds();
    return {
      ...bounds,
      maxY: Math.min(bounds.maxY, this.balance.playArea.chickenAreaTopY),
    };
  }

  private redrawBackground(): void {
    if (!this.backgroundGraphics) {
      return;
    }
    const graphics = this.backgroundGraphics;
    const width = this.balance.playArea.width;
    const height = this.balance.playArea.height;
    const bounds = this.getBounds();
    const chickenBounds = this.getChickenBounds();
    graphics.clear();

    if (!this.backgroundSkinReady) {
      graphics.fillColor = new Color(80, 190, 255, 255);
      graphics.rect(-width * 0.5, chickenBounds.maxY, width, height * 0.5 - chickenBounds.maxY);
      graphics.fill();

      graphics.fillColor = new Color(109, 190, 80, 255);
      graphics.rect(-width * 0.5, -height * 0.5, width, chickenBounds.maxY + height * 0.5);
      graphics.fill();

      graphics.fillColor = new Color(146, 219, 96, 255);
      graphics.rect(bounds.minX, chickenBounds.minY, bounds.maxX - bounds.minX, chickenBounds.maxY - chickenBounds.minY);
      graphics.fill();

      graphics.fillColor = new Color(255, 255, 255, 210);
      graphics.circle(-410, 210, 34);
      graphics.circle(-365, 220, 42);
      graphics.circle(-320, 210, 30);
      graphics.fill();

      graphics.circle(315, 245, 28);
      graphics.circle(350, 255, 38);
      graphics.circle(390, 244, 26);
      graphics.fill();
    }

    graphics.strokeColor = new Color(128, 84, 42, 255);
    graphics.lineWidth = 8;
    graphics.rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    graphics.stroke();
    graphics.strokeColor = new Color(99, 154, 69, 255);
    graphics.lineWidth = 5;
    graphics.moveTo(bounds.minX, chickenBounds.maxY);
    graphics.lineTo(bounds.maxX, chickenBounds.maxY);
    graphics.stroke();
    if (!this.backgroundSkinReady) {
      graphics.fillColor = new Color(238, 183, 82, 255);
      graphics.rect(-610, 278, 370, 64);
      graphics.fill();
    }

    for (const obstacle of this.levelConfig.obstacles) {
      const x = obstacle.position.x - obstacle.size.x * 0.5;
      const y = obstacle.position.y - obstacle.size.y * 0.5;
      graphics.fillColor = new Color(214, 152, 64, 255);
      graphics.rect(x, y, obstacle.size.x, obstacle.size.y);
      graphics.fill();
      graphics.strokeColor = new Color(137, 88, 40, 255);
      graphics.lineWidth = 5;
      graphics.rect(x, y, obstacle.size.x, obstacle.size.y);
      graphics.stroke();
      graphics.strokeColor = new Color(241, 207, 107, 255);
      graphics.lineWidth = 3;
      graphics.moveTo(x + 12, y + obstacle.size.y * 0.5);
      graphics.lineTo(x + obstacle.size.x - 12, y + obstacle.size.y * 0.5);
      graphics.stroke();
    }
  }

  private redrawLine(): void {
    if (!this.lineGraphics) {
      return;
    }

    this.clearVineSegments();
    const graphics = this.lineGraphics;
    graphics.clear();
    if (this.linePoints.length < 2) {
      return;
    }

    graphics.strokeColor = new Color(44, 142, 58, 255);
    graphics.lineWidth = 14;
    graphics.moveTo(this.linePoints[0].x, this.linePoints[0].y);
    for (let i = 1; i < this.linePoints.length; i += 1) {
      graphics.lineTo(this.linePoints[i].x, this.linePoints[i].y);
    }
    graphics.stroke();

    graphics.strokeColor = new Color(160, 231, 101, 255);
    graphics.lineWidth = 5;
    graphics.moveTo(this.linePoints[0].x, this.linePoints[0].y + 2);
    for (let i = 1; i < this.linePoints.length; i += 1) {
      graphics.lineTo(this.linePoints[i].x, this.linePoints[i].y + 2);
    }
    graphics.stroke();

    for (let i = 1; i < this.linePoints.length; i += 1) {
      this.createVineSegment(this.linePoints[i - 1], this.linePoints[i]);
    }
  }

  private createVineSegment(start: Vec2, end: Vec2): void {
    const segmentLength = distance(start, end);
    if (segmentLength <= 0) {
      return;
    }

    const node = new Node('VineSegmentSkin');
    node.layer = this.node.layer;
    node.setPosition((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, 0);
    node.angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    this.node.addChild(node);
    node.setSiblingIndex(11);
    node.addComponent(UITransform).setContentSize(segmentLength + 18, 22);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.loadSpriteFrame(UI_ASSET_PATHS.vineTexture, sprite);
    this.vineSegmentNodes.push(node);
  }

  private clearVineSegments(): void {
    for (const node of this.vineSegmentNodes) {
      if (node.isValid) {
        node.destroy();
      }
    }
    this.vineSegmentNodes = [];
  }

  private updateHud(): void {
    if (!this.countdownValueLabel) {
      return;
    }
    this.countdownValueLabel.string = this.formatCountdownValue();
  }

  private formatCountdownValue(): string {
    return Math.max(0, this.timeLeft).toFixed(1);
  }

  private updateHint(): void {
    if (!this.hintLabel) {
      return;
    }
    if (this.state === 'paused') {
      this.hintLabel.string = `${this.getLineAllowanceText()}  Paused`;
      return;
    }
    this.hintLabel.string = `${this.getLineAllowanceText()}  Drag once to draw a vine defense line`;
  }

  private getLineAllowanceText(): string {
    if (this.lineCommitted) {
      return 'Vine: 0/1 used';
    }
    return 'Vine: 1/1 available';
  }
}
