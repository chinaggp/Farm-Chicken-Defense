import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  resources,
  JsonAsset,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import { DEFAULT_GAME_BALANCE, getM1LevelConfig, M1_LEVEL_CONFIGS } from './config/M1LevelConfigs';
import type { GameBalanceConfig, GameState, M1LevelConfig, ObstacleConfig, RuntimeChicken, RuntimeEagle } from './config/GameTypes';
import {
  appendPointWithinLength,
  circleTouchesPolyline,
  clamp,
  distance,
  normalizeOrFallback,
  randomRange,
  reflectVelocity,
  totalPolylineLength,
} from './gameplay/Geometry';
import { MockAdService } from './services/MockAdService';

const { ccclass } = _decorator;

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

  private backgroundGraphics: Graphics | null = null;
  private lineGraphics: Graphics | null = null;
  private hudLabel: Label | null = null;
  private hintLabel: Label | null = null;
  private resultPanel: Node | null = null;
  private resultTitle: Label | null = null;
  private resultButton: Node | null = null;
  private resultButtonLabel: Label | null = null;
  private pauseButton: Node | null = null;
  private pauseButtonLabel: Label | null = null;
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
    this.backgroundGraphics = this.createGraphicsNode('Background', -10);
    this.lineGraphics = this.createGraphicsNode('DefenseLine', 10);

    this.hudLabel = this.createLabel('HUD', '', new Vec2(-560, 315), 24, new Color(102, 62, 28, 255));
    this.hintLabel = this.createLabel('Hint', '', new Vec2(0, -318), 22, new Color(72, 120, 42, 255));

    this.createHudControls();
    this.createResultPanel();
    this.redrawBackground();
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

  private createHudControls(): void {
    this.pauseButton = this.createTopRightButton('PauseButton', 'Pause', new Vec2(420, 314), 132);
    this.pauseButtonLabel = this.pauseButton.getChildByName('PauseButtonLabel')?.getComponent(Label) ?? null;
    this.pauseButton.on(Node.EventType.TOUCH_END, this.onPauseButton, this);

    this.restartButton = this.createTopRightButton('RestartButton', 'Restart', new Vec2(555, 314), 142);
    this.restartButton.on(Node.EventType.TOUCH_END, this.onRestartButton, this);
  }

  private createTopRightButton(name: string, text: string, position: Vec2, width: number): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(position.x, position.y, 0);
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(width, 52);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(238, 183, 82, 255);
    graphics.strokeColor = new Color(116, 73, 36, 255);
    graphics.lineWidth = 4;
    graphics.rect(-width * 0.5, -26, width, 52);
    graphics.fill();
    graphics.stroke();
    this.createChildLabel(node, `${name}Label`, text, new Vec2(0, -10), 22, new Color(78, 45, 24, 255));
    return node;
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
    if (this.pauseButtonLabel) {
      this.pauseButtonLabel.string = 'Pause';
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
    return node;
  }

  private createEagleNode(): Node {
    const node = new Node('Eagle');
    node.layer = this.node.layer;
    this.node.addChild(node);
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
    return node;
  }

  private updateChickens(deltaTime: number): void {
    const bounds = this.getBounds();
    for (const chicken of this.chickens) {
      if (!chicken.alive) {
        continue;
      }

      chicken.bounceCooldownLeft = Math.max(0, chicken.bounceCooldownLeft - deltaTime);
      chicken.position.x += chicken.velocity.x * deltaTime;
      chicken.position.y += chicken.velocity.y * deltaTime;

      if (chicken.position.x < bounds.minX || chicken.position.x > bounds.maxX || chicken.position.y < bounds.minY || chicken.position.y > bounds.maxY) {
        this.finishGame(false);
        return;
      }

      if (chicken.position.x - chicken.radius < bounds.minX || chicken.position.x + chicken.radius > bounds.maxX) {
        chicken.velocity.x *= -1;
        chicken.position.x = clamp(chicken.position.x, bounds.minX + chicken.radius, bounds.maxX - chicken.radius);
      }
      if (chicken.position.y - chicken.radius < bounds.minY || chicken.position.y + chicken.radius > bounds.maxY) {
        chicken.velocity.y *= -1;
        chicken.position.y = clamp(chicken.position.y, bounds.minY + chicken.radius, bounds.maxY - chicken.radius);
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
      if (this.pauseButtonLabel) {
        this.pauseButtonLabel.string = 'Resume';
      }
      this.updateHint();
      return;
    }

    if (this.state === 'paused') {
      this.state = 'playing';
      if (this.pauseButtonLabel) {
        this.pauseButtonLabel.string = 'Pause';
      }
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

    const canContinue = appendPointWithinLength(this.linePoints, next, this.balance.line.maxLength);
    if (this.linePoints.length >= 2) {
      this.lineCommitted = true;
    }
    this.redrawLine();
    this.updateHint();
    if (!canContinue || totalPolylineLength(this.linePoints) >= this.balance.line.maxLength) {
      this.isDrawing = false;
    }
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

  private redrawBackground(): void {
    if (!this.backgroundGraphics) {
      return;
    }
    const graphics = this.backgroundGraphics;
    const width = this.balance.playArea.width;
    const height = this.balance.playArea.height;
    const bounds = this.getBounds();
    graphics.clear();
    graphics.fillColor = new Color(129, 214, 91, 255);
    graphics.rect(-width * 0.5, -height * 0.5, width, height);
    graphics.fill();
    graphics.fillColor = new Color(109, 190, 80, 255);
    graphics.rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    graphics.fill();
    graphics.strokeColor = new Color(128, 84, 42, 255);
    graphics.lineWidth = 8;
    graphics.rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    graphics.stroke();
    graphics.fillColor = new Color(238, 183, 82, 255);
    graphics.rect(-610, 278, 370, 64);
    graphics.fill();

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
  }

  private updateHud(): void {
    if (!this.hudLabel) {
      return;
    }
    const aliveCount = this.chickens.filter((chicken) => chicken.alive).length;
    this.hudLabel.string = `${this.levelConfig.title}  Time ${Math.ceil(this.timeLeft)}  Chicks ${aliveCount}/${this.chickens.length}`;
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
