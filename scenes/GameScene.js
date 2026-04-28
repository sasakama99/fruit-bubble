// ============================================================
//  フルーツ定義
// ============================================================
const FRUITS = [
  { level: 1, name: 'グレープ',        score: 10,    size: 40,  color: '#B39DDB' },
  { level: 2, name: 'みかん',           score: 30,    size: 50,  color: '#FFB74D' },
  { level: 3, name: 'りんご',           score: 80,    size: 62,  color: '#EF9A9A' },
  { level: 4, name: 'レモン',           score: 200,   size: 74,  color: '#FFF176' },
  { level: 5, name: 'もも',             score: 500,   size: 86,  color: '#F48FB1' },
  { level: 6, name: 'パイナップル',     score: 1200,  size: 100, color: '#A5D6A7' },
  { level: 7, name: 'スイカ',           score: 3000,  size: 116, color: '#80CBC4' },
  { level: 8, name: 'レインボー',       score: 10000, size: 130, color: null      },
];

// レイアウト定数
const GAME_W     = 480;
const GAME_H     = 720;
const HEADER_H   = 100;
const FOOTER_H   = 80;
const FIELD_H    = GAME_H - HEADER_H - FOOTER_H;   // 540
const LANE_COUNT = 5;
const LANE_W     = GAME_W / LANE_COUNT;              // 96
const SLOT_H     = 72;
const MAX_ROWS   = Math.floor(FIELD_H / SLOT_H);    // 7
// row6（7個目）の上端ギリギリ = 8個目でゲームオーバー
const DANGER_Y   = HEADER_H + FIELD_H - 7 * SLOT_H; // 136

// ランクマイルストーン（ゲームオーバー時の「あと○○pt」計算用）
const RANK_MILESTONES = [500, 2000, 5000, 15000, 50000, 150000, 500000];

// ============================================================
//  色ユーティリティ
// ============================================================
function hexToRgb(hex) {
  if (!hex) return { r: 180, g: 180, b: 180 };
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 180, g: 180, b: 180 };
}
function lighter(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`;
}
function darker(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`;
}

// ============================================================
//  GameScene
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  preload() {
    this._buildFruitTextures();
    // BGM / SE 読み込み
    this.load.audio('bgm_main',      'assets/Fruity Loop.mp3');
    this.load.audio('bgm_fever',     'assets/Rainbow Fever.mp3');
    this.load.audio('jingle_gameover', 'assets/See You Next Time.mp3');
  }

  create() {
    this._drawField();
    this._initGame();
    // 再起動時に確実にリセットされるよう shutdown で明示クリーンアップ
    this.events.once('shutdown', this._onShutdown, this);
  }

  _onShutdown() {
    if (this.pushTimer)         { this.pushTimer.remove();         this.pushTimer         = null; }
    if (this.pushTimerTween)    { this.pushTimerTween.stop();      this.pushTimerTween    = null; }
    if (this.feverColorTimer)   { this.feverColorTimer.remove();   this.feverColorTimer   = null; }
    if (this.feverCountdown)    { this.feverCountdown.remove();    this.feverCountdown    = null; }
    if (this.bobTween)          { this.bobTween.stop();            this.bobTween          = null; }
    if (this.sound)             { this.sound.stopAll(); }
    // 表示オブジェクト参照も無効化（次の create でフレッシュに作り直される）
    this.currentSprite = null;
    this.bottomFruits  = null;
    this.bottomLevels  = null;
    this.pushBar       = null;
    this.pushTimerText = null;
    this.pushCountLabel= null;
  }

  // ============================================================
  //  初期化
  // ============================================================
  _initGame() {
    this.grid         = [[], [], [], [], []];
    this.gridSprites  = [[], [], [], [], []];
    this.score        = 0;
    this.combo        = 0;
    this.state        = 'WAITING';
    this.currentLevel = null;
    this.currentSprite = null;
    this.bobTween     = null;

    // フィーバー状態
    this.feverMode    = false;
    this.feverTimeLeft = 0;
    this.feverBg      = null;
    this.feverColorTimer = null;
    this.feverCountdown  = null;
    this.feverTimerText  = null;
    this.hasFevered   = false;   // フィーバー未経験フラグ（バッジ判定用）

    // バッジ：プレイ回数チェック
    this._emitBadges(window.BadgeManager.checkPlay());

    // Web Audio
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.audioCtx = null; }

    this.nextLevel = this._randomLevel();

    // BGM 開始（シーン再起動時は一旦全停止）
    this.sound.stopAll();
    this.sound.play('bgm_main', { loop: true, volume: 0.55 });

    this.scene.launch('UIScene');
    this.time.delayedCall(150, () => this._updateUI());

    // 下押し出しフルーツ（リセット）
    if (this.pushTimer)      { this.pushTimer.remove();      this.pushTimer      = null; }
    if (this.pushTimerTween) { this.pushTimerTween.stop();   this.pushTimerTween = null; }
    if (this.bottomFruits)   { this.bottomFruits.forEach(s => { if (s && s.scene) s.destroy(); }); }
    this.bottomFruits  = [];
    this.bottomLevels  = [];

    this._setupLaneInteraction();
    this._spawnCurrent();

    // 少し遅らせてフルーツを出現させる
    this.time.delayedCall(400, () => {
      this._initBottomFruits();
      this._startPushTimer();
    });
  }

  // ============================================================
  //  ランダムレベル（Lv1〜4 のみスポーン）
  // ============================================================
  _randomLevel() {
    // Lv1〜5をスポーン対象にすることで、孤立したLv5が詰まらないようにする
    // Lv5は約4%の確率で出現（以前は合体でのみ生成されていた）
    const weights = [42, 28, 17, 9, 4]; // Lv1〜Lv5
    let rand = Phaser.Math.Between(1, 100);
    for (let i = 0; i < weights.length; i++) {
      if ((rand -= weights[i]) <= 0) return i + 1;
    }
    return 1;
  }

  // ============================================================
  //  Step4: 現在フルーツをヘッダーに表示
  // ============================================================
  _spawnCurrent() {
    if (this.state === 'GAME_OVER') return;

    this.currentLevel = this.nextLevel;
    this.nextLevel    = this._randomLevel();
    this.state        = 'WAITING';
    this.combo        = 0;

    if (this.bobTween) { this.bobTween.stop(); this.bobTween = null; }
    if (this.currentSprite) this.currentSprite.destroy();

    const scale = this._fruitScale(this.currentLevel) * 1.1;
    this.currentSprite = this.add.image(GAME_W / 2, 58, `fruit_${this.currentLevel}`)
      .setOrigin(0.5).setScale(0).setDepth(10);

    this.tweens.add({
      targets: this.currentSprite,
      scaleX: scale, scaleY: scale,
      duration: 240, ease: 'Back.easeOut',
      onComplete: () => {
        this.bobTween = this.tweens.add({
          targets: this.currentSprite,
          y: 52, yoyo: true, repeat: -1,
          duration: 750, ease: 'Sine.easeInOut',
        });
      }
    });

    this._updateUI();
  }

  // ============================================================
  //  座標ヘルパー
  // ============================================================
  _laneX(col)   { return col * LANE_W + LANE_W / 2; }
  _rowY(row)    { return HEADER_H + FIELD_H - (row + 0.5) * SLOT_H; }
  _fruitScale(level) {
    const canvasSize = FRUITS[level - 1].size + 36;
    return Math.min(1.0, (SLOT_H * 0.88) / canvasSize);
  }

  // ============================================================
  //  Step9: レーンインタラクション（タップ＋スワイプ）
  // ============================================================
  _setupLaneInteraction() {
    // レーンハイライト（タッチ中に光る）
    this.laneHL = this.add.rectangle(
      LANE_W / 2, HEADER_H + FIELD_H / 2,
      LANE_W - 4, FIELD_H,
      0xA5D6A7, 0.28
    ).setVisible(false).setDepth(1);

    let swipeStartX = -1;

    // ── pointerdown: スワイプ開始点を記録
    this.input.on('pointerdown', pointer => {
      if (pointer.y < HEADER_H) return;       // ヘッダーは除外
      swipeStartX = pointer.x;
      const col = Phaser.Math.Clamp(Math.floor(pointer.x / LANE_W), 0, LANE_COUNT - 1);
      this.laneHL.setX(this._laneX(col)).setVisible(true);
    });

    // ── pointermove: ハイライトをドラッグ追従
    this.input.on('pointermove', pointer => {
      if (!pointer.isDown || swipeStartX < 0) return;
      const col = Phaser.Math.Clamp(Math.floor(pointer.x / LANE_W), 0, LANE_COUNT - 1);
      this.laneHL.setX(this._laneX(col));
    });

    // ── pointerup: 指を離した位置のレーンへドロップ
    this.input.on('pointerup', pointer => {
      this.laneHL.setVisible(false);
      if (swipeStartX < 0) return;
      const col = Phaser.Math.Clamp(Math.floor(pointer.x / LANE_W), 0, LANE_COUNT - 1);
      this._dropIntoLane(col);
      swipeStartX = -1;
    });
  }

  // ============================================================
  //  Step4: フルーツをレーンへドロップ
  // ============================================================
  _dropIntoLane(col) {
    if (this.state !== 'WAITING') return;

    const row     = this.grid[col].length;
    const targetX = this._laneX(col);
    const targetY = this._rowY(row);
    const level   = this.currentLevel;
    const scale   = this._fruitScale(level);

    // 完全に画面外になる場合のみ物理的にブロック
    if (row >= MAX_ROWS + 3) return;

    this.state = 'ANIMATING';

    // スポーン中・ボブ中のアニメをすべて止め、スケールを即座に確定させる
    this.tweens.killTweensOf(this.currentSprite);
    this.bobTween = null;
    this.currentSprite.setScale(scale * 1.1); // 落下前に見える大きさへスナップ

    this.tweens.add({
      targets: this.currentSprite,
      x: targetX, y: targetY,
      scaleX: scale, scaleY: scale,
      duration: 260, ease: 'Quad.easeOut',
      onComplete: () => {
        this._playSE('drop');

        // 着地バウンス
        this.tweens.add({
          targets: this.currentSprite,
          scaleX: scale * 1.18, scaleY: scale * 0.84,
          duration: 70, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => {
            this.grid[col].push(level);
            this.gridSprites[col].push(this.currentSprite);
            this.currentSprite = null;

            // マッチ消去を先に処理 → 消えた後でゲームオーバー判定
            // （赤線を超えていてもマッチで消えればゲームオーバーにならない）
            this._runMatchCascade(() => this._spawnCurrent());
          }
        });
      }
    });
  }

  // ============================================================
  //  Step5: マッチ検査 → 合体 → カスケード
  // ============================================================
  _runMatchCascade(onDone) {
    const matches = this._findAllMatches();
    if (!matches.length) {
      // カスケード終了：余白があればここで詰める
      this._packAllColumns(true);
      this._checkGameOver();
      if (this.state !== 'GAME_OVER') onDone();
      return;
    }
    this.combo++;
    if (this.combo >= 2) this._playSE('combo');

    this._doMergeMulti(matches, () => {
      if (this.combo >= 2) this._showComboText(this.combo);
      this.time.delayedCall(80, () => this._runMatchCascade(onDone));
    });
  }

  // ============================================================
  //  縦横すべてのマッチを一度に検出
  // ============================================================
  _findAllMatches() {
    // Lv4以上は2個並んでも合体できる（孤立した高レベルフルーツ対策）
    const _minRun = (level) => level >= 4 ? 2 : 3;
    const out = [];
    // ── 横マッチ
    for (let row = 0; row < MAX_ROWS + 2; row++) {
      for (let startCol = 0; startCol < LANE_COUNT; ) {
        if (this.grid[startCol].length <= row) { startCol++; continue; }
        const level = this.grid[startCol][row];
        let runLen = 1;
        while (
          startCol + runLen < LANE_COUNT &&
          this.grid[startCol + runLen].length > row &&
          this.grid[startCol + runLen][row] === level
        ) { runLen++; }
        if (runLen >= _minRun(level)) {
          out.push({ type: 'h', startCol, row, count: runLen, level });
        }
        startCol += runLen;
      }
    }
    // ── 縦マッチ
    for (let col = 0; col < LANE_COUNT; col++) {
      const colGrid = this.grid[col];
      for (let startRow = 0; startRow < colGrid.length; ) {
        const level = colGrid[startRow];
        let runLen = 1;
        while (startRow + runLen < colGrid.length && colGrid[startRow + runLen] === level) {
          runLen++;
        }
        if (runLen >= _minRun(level)) {
          out.push({ type: 'v', col, startRow, count: runLen, level });
        }
        startRow += runLen;
      }
    }
    return out;
  }

  // ============================================================
  //  複数マッチを一斉に消して合体
  // ============================================================
  _doMergeMulti(matches, onDone) {
    const removeSet  = new Set();   // "col,row"
    const insertions = {};          // col -> [{kind, row?, level}]
    const popups     = [];
    const feverMult  = this.feverMode ? 2 : 1;
    let totalScore   = 0;

    const bigExplosions = []; // Lv6以上の爆発消滅リスト

    for (const m of matches) {
      const newLevel  = Math.min(m.level + 1, 8);
      const isBoom    = m.level >= 6;          // Lv6・7→爆発消滅
      const scoreMult = isBoom ? 3 : 1;        // 爆発時はスコア3倍ボーナス
      const addScore  = FRUITS[newLevel - 1].score * this.combo * feverMult * scoreMult;
      totalScore += addScore;

      if (m.type === 'h') {
        for (let c = m.startCol; c < m.startCol + m.count; c++) {
          removeSet.add(`${c},${m.row}`);
        }
        const centerCol = m.startCol + Math.floor(m.count / 2);
        const px = this._laneX(centerCol), py = this._rowY(m.row);
        if (isBoom) {
          bigExplosions.push({ x: px, y: py, level: m.level });
        } else {
          (insertions[centerCol] = insertions[centerCol] || []).push(
            { kind: 'top', level: newLevel }
          );
        }
        popups.push({ x: px, y: py, score: addScore });
      } else {
        for (let r = m.startRow; r < m.startRow + m.count; r++) {
          removeSet.add(`${m.col},${r}`);
        }
        const px = this._laneX(m.col);
        const py = this._rowY(m.startRow + Math.floor(m.count / 2));
        if (isBoom) {
          bigExplosions.push({ x: px, y: py, level: m.level });
        } else {
          (insertions[m.col] = insertions[m.col] || []).push(
            { kind: 'at', row: m.startRow, level: newLevel }
          );
        }
        popups.push({ x: px, y: py, score: addScore });
      }
    }

    this.score += totalScore;
    popups.forEach(p => this._showScorePopup(p.x, p.y, p.score, feverMult > 1));
    this._playSE('merge');

    // ── バッジチェック ──
    const hasH = matches.some(m => m.type === 'h');
    const hasV = matches.some(m => m.type === 'v');
    if (hasH && hasV)            this._emitBadges(window.BadgeManager.checkEvent('multi_match'));
    if (removeSet.size >= 5)     this._emitBadges(window.BadgeManager.checkEvent('match_5'));
    this._emitBadges(window.BadgeManager.checkScore(this.score));
    this._emitBadges(window.BadgeManager.checkCombo(this.combo));
    if (this.feverMode && this.combo >= 2)
      this._emitBadges(window.BadgeManager.checkEvent('fever_combo'));
    // 危険ライン超えクリア判定（row >= 7 のセルが消えたとき）
    for (const key of removeSet) {
      const [, r] = key.split(',').map(Number);
      if (r >= MAX_ROWS) { this._emitBadges(window.BadgeManager.checkEvent('danger_clear')); break; }
    }
    // 生まれるフルーツのレベルチェック
    for (const m of matches) {
      const newLevel = Math.min(m.level + 1, 8);
      this._emitBadges(window.BadgeManager.checkFruit(newLevel));
    }

    // 削除対象スプライトを収集
    const removeSprites = [];
    for (const key of removeSet) {
      const [c, r] = key.split(',').map(Number);
      const spr = this.gridSprites[c] && this.gridSprites[c][r];
      if (spr) removeSprites.push(spr);
    }

    this.tweens.add({
      targets: removeSprites,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 170, ease: 'Quad.easeIn',
      onComplete: () => {
        removeSprites.forEach(s => s.destroy());

        // 各列を圧縮（削除済セルを除去）
        for (let c = 0; c < LANE_COUNT; c++) {
          const ng = [];
          const ns = [];
          for (let r = 0; r < this.grid[c].length; r++) {
            if (!removeSet.has(`${c},${r}`)) {
              ng.push(this.grid[c][r]);
              ns.push(this.gridSprites[c][r]);
            }
          }
          this.grid[c]        = ng;
          this.gridSprites[c] = ns;
        }

        // 新フルーツを挿入
        const newSprites = [];
        Object.keys(insertions).forEach(colKey => {
          const col    = parseInt(colKey, 10);
          const list   = insertions[col];
          const atIns  = list.filter(i => i.kind === 'at').sort((a, b) => a.row - b.row);
          const topIns = list.filter(i => i.kind === 'top');

          // 縦マッチの新フルーツは元の startRow 位置へ挿入
          for (const i of atIns) {
            const insertRow = Math.min(i.row, this.grid[col].length);
            const spr = this.add.image(
              this._laneX(col), this._rowY(insertRow), `fruit_${i.level}`
            ).setOrigin(0.5).setScale(0).setDepth(5);
            this.grid[col].splice(insertRow, 0, i.level);
            this.gridSprites[col].splice(insertRow, 0, spr);
            newSprites.push({ sprite: spr, level: i.level });
          }
          // 横マッチの新フルーツは中央レーンの頂上に
          for (const i of topIns) {
            const insertRow = this.grid[col].length;
            const spr = this.add.image(
              this._laneX(col), this._rowY(insertRow), `fruit_${i.level}`
            ).setOrigin(0.5).setScale(0).setDepth(5);
            this.grid[col].push(i.level);
            this.gridSprites[col].push(spr);
            newSprites.push({ sprite: spr, level: i.level });
          }
        });

        // Lv6・7爆発エフェクト
        bigExplosions.forEach(e => this._bigExplosion(e.x, e.y, e.level));
        // Lv7（スイカ）合体 → フィーバー発動
        if (bigExplosions.some(e => e.level >= 7) && !this.feverMode) {
          this.time.delayedCall(300, () => this._startFever());
        }

        this._updateUI();
        this._packAllColumns(true);

        this.time.delayedCall(140, () => {
          let maxLevel = 0;
          newSprites.forEach(nf => {
            const scale = this._fruitScale(nf.level);
            this.tweens.add({
              targets: nf.sprite,
              scaleX: scale, scaleY: scale,
              duration: 220, ease: 'Back.easeOut',
            });
            if (nf.level > maxLevel) maxLevel = nf.level;
          });
          if (maxLevel === 8 && !this.feverMode) this._startFever();
          this.time.delayedCall(240, onDone);
        });
      },
    });
  }

  // ============================================================
  //  Lv6・7合体 → 大爆発消滅エフェクト
  // ============================================================
  _bigExplosion(x, y, level) {
    // パーティクル用テクスチャ（なければ作成）
    if (!this.textures.exists('boomParticle')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xFFFFFF); g.fillCircle(8, 8, 8);
      g.generateTexture('boomParticle', 16, 16); g.destroy();
    }

    // ── ① 衝撃波リング（外に広がる円）
    const ring = this.add.graphics().setDepth(48);
    ring.lineStyle(6, level >= 7 ? 0xFF4400 : 0xFFAA00, 1);
    ring.strokeCircle(x, y, 10);
    this.tweens.add({
      targets: ring,
      scaleX: 5, scaleY: 5, alpha: 0,
      duration: 500, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // ── ② 黄白フラッシュ
    const flash = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H,
      level >= 7 ? 0xFF6600 : 0xFFDD00, 0).setDepth(55);
    this.tweens.add({
      targets: flash, alpha: { from: 0.65, to: 0 },
      duration: 400, ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // ── ③ カメラシェイク（Lv7はより強め）
    this.cameras.main.shake(level >= 7 ? 450 : 280, level >= 7 ? 0.018 : 0.010);

    // ── ④ 大量パーティクルバースト
    const colors = level >= 7
      ? [0xFF2200, 0xFF6600, 0xFFAA00, 0xFFFF00, 0xFF0088]
      : [0xFFAA00, 0xFFDD00, 0xFFFFAA, 0xFF8800, 0xFF5500];
    colors.forEach((tint, i) => {
      const angle = (i / colors.length) * 360;
      const em = this.add.particles(x, y, 'boomParticle', {
        speed: { min: 200, max: 500 },
        angle: { min: angle - 36, max: angle + 36 },
        lifespan: 800, scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 }, tint, quantity: 8,
        emitting: false,
      }).setDepth(50);
      em.explode(8);
      this.time.delayedCall(1000, () => { if (em && em.scene) em.destroy(); });
    });

    // ── ⑤ 「SUPER!!」 or「AMAZING!!」テキスト
    const label = level >= 7 ? '🌟 AMAZING!! 🌟' : '💥 SUPER!! 💥';
    const col   = level >= 7 ? '#FF4400' : '#FFAA00';
    const boom  = this.add.text(x, y, label, {
      fontSize: '38px', fontFamily: 'Arial Black',
      color: col, stroke: '#fff', strokeThickness: 6,
      shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5).setDepth(52).setScale(0.3).setAlpha(0);
    this.tweens.add({
      targets: boom, alpha: 1, scaleX: 1.1, scaleY: 1.1,
      duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: boom, alpha: 0, y: y - 80, duration: 600, delay: 400,
          ease: 'Quad.easeIn', onComplete: () => boom.destroy(),
        });
      }
    });
  }

  // 横・縦どちらも検出（旧：1件のみ返す互換用）
  _findMatch() {
    const _minRun = (level) => level >= 4 ? 2 : 3;
    // ── 横マッチ（優先）
    for (let row = 0; row < MAX_ROWS + 2; row++) {
      for (let startCol = 0; startCol < LANE_COUNT; ) {
        if (this.grid[startCol].length <= row) { startCol++; continue; }
        const level = this.grid[startCol][row];
        let runLen  = 1;
        while (
          startCol + runLen < LANE_COUNT &&
          this.grid[startCol + runLen].length > row &&
          this.grid[startCol + runLen][row] === level
        ) { runLen++; }
        if (runLen >= _minRun(level)) return { type: 'h', startCol, row, count: runLen, level };
        startCol += runLen;
      }
    }
    // ── 縦マッチ
    for (let col = 0; col < LANE_COUNT; col++) {
      const colGrid = this.grid[col];
      for (let startRow = 0; startRow < colGrid.length; ) {
        const level = colGrid[startRow];
        let runLen  = 1;
        while (startRow + runLen < colGrid.length && colGrid[startRow + runLen] === level) {
          runLen++;
        }
        if (runLen >= _minRun(level)) return { type: 'v', col, startRow, count: runLen, level };
        startRow += runLen;
      }
    }
    return null;
  }

  // 縦マッチ合体
  _doMergeVertical(col, startRow, count, level, onDone) {
    const toRemove = this.gridSprites[col].slice(startRow, startRow + count);

    const newLevel  = Math.min(level + 1, 8);
    const feverMult = this.feverMode ? 2 : 1;
    const addScore  = FRUITS[newLevel - 1].score * this.combo * feverMult;
    this.score     += addScore;
    this._playSE('merge');
    this._showScorePopup(this._laneX(col), this._rowY(startRow + Math.floor(count / 2)), addScore, feverMult > 1);

    this.tweens.add({
      targets: toRemove,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 170, ease: 'Quad.easeIn',
      onComplete: () => {
        toRemove.forEach(s => s.destroy());

        // グリッドから削除
        this.grid[col].splice(startRow, count);
        this.gridSprites[col].splice(startRow, count);

        // 新フルーツを startRow に挿入
        const newLevel2 = newLevel;
        const newScale  = this._fruitScale(newLevel2);
        const newSprite = this.add.image(
          this._laneX(col), this._rowY(startRow), `fruit_${newLevel2}`
        ).setOrigin(0.5).setScale(0).setDepth(5);

        this.grid[col].splice(startRow, 0, newLevel2);
        this.gridSprites[col].splice(startRow, 0, newSprite);

        // 上段を正しい位置へ
        for (let r = startRow + 1; r < this.gridSprites[col].length; r++) {
          this.tweens.add({ targets: this.gridSprites[col][r], y: this._rowY(r), duration: 150, ease: 'Quad.easeOut' });
        }

        this._updateUI();

        this.time.delayedCall(160, () => {
          this.tweens.add({
            targets: newSprite,
            scaleX: newScale, scaleY: newScale,
            duration: 220, ease: 'Back.easeOut',
            onComplete: () => {
              if (newLevel2 === 8 && !this.feverMode) this._startFever();
              onDone();
            },
          });
        });
      }
    });
  }

  // 横マッチ合体
  _doMerge(startCol, row, count, level, onDone) {
    const toRemove = [];
    for (let c = startCol; c < startCol + count; c++) {
      toRemove.push(this.gridSprites[c][row]);
    }

    const newLevel    = Math.min(level + 1, 8);
    // Step7: フィーバー中はスコア2倍
    const feverMult   = this.feverMode ? 2 : 1;
    const addScore    = FRUITS[newLevel - 1].score * this.combo * feverMult;
    this.score       += addScore;

    // Step9: 合体SE
    this._playSE('merge');

    // スコアポップアップ
    const mergeX = this._laneX(startCol + Math.floor(count / 2));
    const mergeY = this._rowY(row);
    this._showScorePopup(mergeX, mergeY, addScore, feverMult > 1);

    // 合体アニメ（縮小消滅）
    this.tweens.add({
      targets: toRemove,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 170, ease: 'Quad.easeIn',
      onComplete: () => {
        for (let c = startCol; c < startCol + count; c++) {
          toRemove[c - startCol].destroy();
          this.grid[c].splice(row, 1);
          this.gridSprites[c].splice(row, 1);
          // 上段フルーツを1段落とす
          for (let r = row; r < this.gridSprites[c].length; r++) {
            this.tweens.add({
              targets: this.gridSprites[c][r],
              y: this._rowY(r),
              duration: 150, ease: 'Quad.easeOut',
            });
          }
        }

        this._updateUI();

        // 新フルーツを中央レーンに配置
        const centerCol = startCol + Math.floor(count / 2);
        const newRow    = this.grid[centerCol].length;
        const newScale  = this._fruitScale(newLevel);

        this.time.delayedCall(160, () => {
          const newSprite = this.add.image(
            this._laneX(centerCol), this._rowY(newRow), `fruit_${newLevel}`
          ).setOrigin(0.5).setScale(0).setDepth(5);

          this.grid[centerCol].push(newLevel);
          this.gridSprites[centerCol].push(newSprite);

          this.tweens.add({
            targets: newSprite,
            scaleX: newScale, scaleY: newScale,
            duration: 220, ease: 'Back.easeOut',
            onComplete: () => {
              // Step7: Lv8 到達でフィーバー発動
              if (newLevel === 8 && !this.feverMode) this._startFever();
              onDone();
            },
          });
        });
      }
    });
  }

  // ============================================================
  //  Step7: フィーバータイム
  // ============================================================
  _startFever() {
    this.feverMode     = true;
    this.feverTimeLeft = 15;
    this.hasFevered    = true;
    this._emitBadges(window.BadgeManager.checkEvent('fever'));

    this._playSE('fever');
    this.sound.stopAll();
    this.sound.play('bgm_fever', { loop: true, volume: 0.65 });

    // ── ① 白フラッシュ（全画面）
    const flash = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0xFFFFFF, 0).setDepth(55);
    this.tweens.add({
      targets: flash, alpha: { from: 0.85, to: 0 },
      duration: 600, ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // ── ② カメラシェイク
    this.cameras.main.shake(500, 0.012);

    // ── ③ 虹色パーティクルバースト（画面中央から放射）
    if (!this.textures.exists('fvParticle')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xFFFFFF); g.fillCircle(6, 6, 6);
      g.generateTexture('fvParticle', 12, 12); g.destroy();
    }
    const burstColors = [0xFF4444, 0xFF8800, 0xFFD700, 0x44DD44, 0x44AAFF, 0xDD44FF, 0xFF44AA];
    burstColors.forEach((tint, i) => {
      const angle = (i / burstColors.length) * Math.PI * 2;
      const em = this.add.particles(GAME_W / 2, GAME_H / 2, 'fvParticle', {
        speed: { min: 180, max: 420 },
        angle: { min: Phaser.Math.RadToDeg(angle) - 22, max: Phaser.Math.RadToDeg(angle) + 22 },
        lifespan: 900, scale: { start: 1.0, end: 0 },
        alpha: { start: 1, end: 0 }, tint, quantity: 6,
        emitting: false,
      }).setDepth(52);
      em.explode(6);
      this.time.delayedCall(1200, () => { if (em && em.scene) em.destroy(); });
    });

    // ── ④「FEVER!」テキスト（スケール＋シェイク）
    const feverTxt = this.add.text(GAME_W / 2, GAME_H / 2, '🌈 FEVER! 🌈', {
      fontSize: '76px', fontFamily: 'Arial Black',
      color: '#FFD700', stroke: '#FF2200', strokeThickness: 10,
      shadow: { offsetX: 4, offsetY: 4, color: '#FF6600', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(51).setAlpha(0).setScale(0.2);

    this.tweens.add({
      targets: feverTxt,
      alpha: 1, scaleX: 1.25, scaleY: 1.25,
      duration: 380, ease: 'Back.easeOut',
      onComplete: () => {
        // 左右シェイク
        this.tweens.add({
          targets: feverTxt, x: { from: GAME_W/2 - 8, to: GAME_W/2 + 8 },
          yoyo: true, repeat: 4, duration: 60, ease: 'Sine.easeInOut',
          onComplete: () => {
            this.tweens.add({
              targets: feverTxt, alpha: 0, y: feverTxt.y - 100, scaleX: 0.8, scaleY: 0.8,
              duration: 600, delay: 300, ease: 'Quad.easeIn',
              onComplete: () => feverTxt.destroy(),
            });
          }
        });
      }
    });

    // ── ⑤「スコア2倍!」サブテキスト
    const multTxt = this.add.text(GAME_W / 2, GAME_H / 2 + 80, window.t().scoreX2, {
      fontSize: '34px', fontFamily: 'Arial Black',
      color: '#FF6B6B', stroke: '#fff', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(51).setAlpha(0);
    this.tweens.add({
      targets: multTxt, alpha: 1, duration: 300, delay: 250,
      onComplete: () => {
        this.tweens.add({
          targets: multTxt, alpha: 0,
          duration: 500, delay: 700, ease: 'Quad.easeIn',
          onComplete: () => multTxt.destroy(),
        });
      }
    });

    // ── ⑥ 虹色フィールド背景
    this.feverBg = this.add.rectangle(
      GAME_W / 2, HEADER_H + FIELD_H / 2, GAME_W, FIELD_H, 0xFF6B6B, 0.18
    ).setDepth(0);

    const feverColors = [0xFF6B6B, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0xC77DFF];
    let ci = 0;
    this.feverColorTimer = this.time.addEvent({
      delay: 200, loop: true,
      callback: () => {
        ci = (ci + 1) % feverColors.length;
        this.feverBg.setFillStyle(feverColors[ci], 0.22);
      }
    });

    // カウントダウンテキスト
    this.feverTimerText = this.add.text(GAME_W - 8, HEADER_H + 8, '⏱ 15s', {
      fontSize: '15px', fontFamily: 'Arial',
      color: '#FFD700', stroke: '#FF4400', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(20);

    // UIScene にフィーバーバーを通知
    const ui = this.scene.get('UIScene');
    if (ui && ui.startFeverBar) ui.startFeverBar(15);

    // 毎秒カウントダウン
    this.feverCountdown = this.time.addEvent({
      delay: 1000, repeat: 14,
      callback: () => {
        this.feverTimeLeft--;
        if (this.feverTimerText) {
          this.feverTimerText.setText(`⏱ ${this.feverTimeLeft}s`);
          if (this.feverTimeLeft <= 5) this.feverTimerText.setColor('#FF4444');
        }
        if (this.feverTimeLeft <= 0) this._endFever();
      }
    });
  }

  _endFever() {
    this.feverMode = false;
    if (this.feverColorTimer) { this.feverColorTimer.remove(); this.feverColorTimer = null; }
    if (this.feverCountdown)  { this.feverCountdown.remove();  this.feverCountdown  = null; }
    if (this.feverBg)         { this.feverBg.destroy();         this.feverBg         = null; }
    if (this.feverTimerText)  { this.feverTimerText.destroy();  this.feverTimerText  = null; }

    const ui = this.scene.get('UIScene');
    if (ui && ui.endFeverBar) ui.endFeverBar();

    // BGM: bgm_fever → bgm_main に戻す
    this.sound.stopAll();
    this.sound.play('bgm_main', { loop: true, volume: 0.55 });

    // 「フィーバー終了」テキスト
    const endTxt = this.add.text(GAME_W / 2, GAME_H / 2, window.t().feverEnd, {
      fontSize: '28px', fontFamily: 'Arial',
      color: '#888', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: endTxt, alpha: 0, y: endTxt.y - 40,
      duration: 800, delay: 400, ease: 'Quad.easeIn',
      onComplete: () => endTxt.destroy(),
    });
  }

  // ============================================================
  //  Step7: コンボテキストエフェクト
  // ============================================================
  _showComboText(combo) {
    const colors = ['#FF6B00','#FF3399','#9B59B6','#E74C3C'];
    const color  = colors[Math.min(combo - 2, colors.length - 1)];
    const txt = this.add.text(GAME_W / 2, GAME_H / 2 - 50, `x${combo} COMBO!`, {
      fontSize: `${Math.min(38 + (combo - 2) * 4, 54)}px`,
      fontFamily: 'Arial Black',
      color: color, stroke: '#fff', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.tweens.add({
      targets: txt,
      alpha: { from: 0, to: 1 },
      scaleX: { from: 0.4, to: 1.3 }, scaleY: { from: 0.4, to: 1.3 },
      duration: 230, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: txt, alpha: 0, y: txt.y - 60,
          duration: 600, delay: 350, ease: 'Quad.easeIn',
          onComplete: () => txt.destroy(),
        });
      }
    });
  }

  // スコアポップアップ（合体位置から浮き上がる）
  _showScorePopup(x, y, score, isFever) {
    const label = isFever ? `+${score.toLocaleString()} 🔥` : `+${score.toLocaleString()}`;
    const pop = this.add.text(x, y - 20, label, {
      fontSize: '20px', fontFamily: 'Arial',
      color: isFever ? '#FFD700' : '#333',
      stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);

    this.tweens.add({
      targets: pop,
      y: y - 70, alpha: 0,
      duration: 900, ease: 'Quad.easeOut',
      onComplete: () => pop.destroy(),
    });
  }

  // ============================================================
  //  バッジ発火ヘルパー
  // ============================================================
  _emitBadges(defs) {
    if (!defs || !defs.length) return;
    defs.forEach(def => {
      this.game.events.emit('badge-unlocked', def);
    });
  }

  // ============================================================
  //  Step9: Web Audio API 効果音
  // ============================================================
  _playSE(type) {
    const ui = this.scene.get('UIScene');
    if (ui && ui.soundOn === false) return;
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const mkOsc = (freq, type_, gainVal, start, dur) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type_;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(gainVal, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start); osc.stop(start + dur);
    };

    switch (type) {
      case 'drop':
        // ポコン（短い下降）
        { const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(350, now);
          o.frequency.exponentialRampToValueAtTime(220, now + 0.09);
          g.gain.setValueAtTime(0.12, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          o.start(now); o.stop(now + 0.12); }
        break;

      case 'merge':
        // 上昇音（チャリン）
        mkOsc(440, 'sine',     0.25, now,        0.04);
        mkOsc(880, 'triangle', 0.2,  now + 0.03, 0.18);
        break;

      case 'combo':
        // キラキラ4連符
        [523, 659, 784, 1047].forEach((freq, i) => {
          mkOsc(freq, 'triangle', 0.18, now + i * 0.065, 0.16);
        });
        break;

      case 'fever':
        // 明るい上昇アルペジオ
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          mkOsc(freq, 'sine', 0.28, now + i * 0.085, 0.28);
        });
        break;

      case 'gameover':
        // 下降サイン波
        { const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(440, now);
          o.frequency.exponentialRampToValueAtTime(100, now + 0.7);
          g.gain.setValueAtTime(0.28, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
          o.start(now); o.stop(now + 0.75); }
        break;
    }
  }

  // ============================================================
  //  レーン満杯シェイク
  // ============================================================
  _shakeColumn(col) {
    const sprites = this.gridSprites[col];
    if (!sprites.length) return;
    const baseXs = sprites.map(s => s.x);
    sprites.forEach((s, i) => {
      this.tweens.add({
        targets: s, x: baseXs[i] + 7,
        yoyo: true, repeat: 3, duration: 45, ease: 'Sine.easeInOut',
        onComplete: () => { s.x = baseXs[i]; }
      });
    });
    // 満杯レーン赤フラッシュ
    const flash = this.add.rectangle(
      this._laneX(col), HEADER_H + FIELD_H / 2,
      LANE_W - 2, FIELD_H, 0xFF5252, 0.35
    ).setDepth(2);
    this.time.delayedCall(300, () => flash.destroy());
  }

  // ============================================================
  //  列のフルーツを正しい y 位置へ強制スナップ（余白バグ対策）
  //   ツイーン中断等で位置がズレた場合も、このパスで確実に詰める
  // ============================================================
  _packAllColumns(animate = true) {
    for (let col = 0; col < LANE_COUNT; col++) {
      const sprites = this.gridSprites[col];
      if (!sprites) continue;
      for (let r = 0; r < sprites.length; r++) {
        const s = sprites[r];
        if (!s || !s.scene) continue;
        const targetY = this._rowY(r);
        const targetX = this._laneX(col);
        // Y方向のツイーンのみキル（スケール等の演出ツイーンは残す）
        this.tweens.getTweensOf(s).forEach(t => {
          if (t.data && t.data.some(d => d.key === 'y')) t.stop();
        });
        if (animate && Math.abs(s.y - targetY) > 0.5) {
          this.tweens.add({
            targets: s, y: targetY, x: targetX,
            duration: 120, ease: 'Quad.easeOut',
          });
        } else {
          s.y = targetY;
          s.x = targetX;
        }
      }
    }
  }

  // ============================================================
  //  Step8: ゲームオーバー判定
  // ============================================================
  _checkGameOver() {
    for (let col = 0; col < LANE_COUNT; col++) {
      const top = this.grid[col].length - 1;
      // 合体後などに上端がラインを超えていないか確認
      if (top >= 0 && this._rowY(top) - SLOT_H / 2 < DANGER_Y) {
        this._triggerGameOver(); return;
      }
    }
  }

  _triggerGameOver() {
    if (this.state === 'GAME_OVER') return;
    this.state = 'GAME_OVER';
    if (this.feverMode) this._endFever();

    // 下押し出しタイマーを停止
    if (this.pushTimer)      { this.pushTimer.remove();      this.pushTimer      = null; }
    if (this.pushTimerTween) { this.pushTimerTween.stop();   this.pushTimerTween = null; }
    if (this.bottomFruits)   { this.bottomFruits.forEach(s => { if (s && s.scene) s.destroy(); }); this.bottomFruits = []; }

    this._playSE('gameover');
    // BGM: 全停止 → ゲームオーバー曲を再生
    this.sound.stopAll();
    this.sound.play('jingle_gameover', { volume: 0.7 });

    const safeScore  = isNaN(this.score) ? 0 : this.score;
    const prevBest   = parseInt(localStorage.getItem('fruitBubbleBest') || '0', 10) || 0;
    const best       = Math.max(safeScore, prevBest);
    const nextRankPts = this._calcNextRankPts(this.score);
    localStorage.setItem('fruitBubbleBest', String(best));
    this.score = safeScore;

    // ── ゲームオーバー時バッジチェック
    if (safeScore > prevBest && prevBest >= 0)
      this._emitBadges(window.BadgeManager.checkEvent('new_best'));
    if (safeScore >= 5000 && !this.hasFevered)
      this._emitBadges(window.BadgeManager.checkEvent('no_fever_5k'));

    // 画面フラッシュ
    const flashRect = this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0xFF5252, 0).setDepth(60);
    this.tweens.add({
      targets: flashRect,
      alpha: { from: 0, to: 0.4 },
      duration: 200, yoyo: true, repeat: 2,
    });

    this.time.delayedCall(700, () => {
      this.scene.stop('UIScene');

      // 広告終了後（or SDK未対応）にゲームオーバー画面を表示
      const showGameOver = () => {
        this.scene.launch('GameOverScene', {
          score: this.score,
          bestScore: best,
          nextRankPts,
        });
      };

      // GameMonetize インタースティシャル（全画面広告）
      // 広告が終わったコールバックで GameOverScene を起動
      if (typeof sdk !== 'undefined' && sdk.showInterstitial) {
        sdk.showInterstitial(showGameOver);
      } else {
        showGameOver();
      }
    });
  }

  // ============================================================
  //  下から押し出しフルーツ
  // ============================================================
  _initBottomFruits() {
    if (this.state === 'GAME_OVER') return;
    if (this.bottomFruits) {
      this.bottomFruits.forEach(s => { if (s && s.scene) s.destroy(); });
    }
    // null で初期化（レーン数分）
    this.bottomFruits = new Array(LANE_COUNT).fill(null);
    this.bottomLevels = new Array(LANE_COUNT).fill(null);

    // 常に5列全部を押し上げる
    // （1列だけ押すと列ごとの高さがずれ、横並びのフルーツが
    //   同一グリッド行にならずマッチ判定できないバグが発生するため）
    const activeCols = [0, 1, 2, 3, 4];

    // ラベル更新
    if (this.pushCountLabel) {
      const tx = window.t();
      this.pushCountLabel.setText(tx.pushAll).setColor('#E53935');
    }

    // ── レベル生成（横3マッチ禁止）
    const levels = new Array(LANE_COUNT).fill(null);
    for (const col of activeCols) {
      let level, tries = 0;
      do {
        level = this._randomLevel();
        tries++;
      } while (tries < 20 && this._bottomWouldMatch3(levels, col, level));
      levels[col] = level;
    }

    // ── スプライト生成
    activeCols.forEach((col, idx) => {
      const level = levels[col];
      const bx    = this._laneX(col);
      const by    = GAME_H - FOOTER_H / 2 + 6;
      const scale = this._fruitScale(level) * 0.85;

      const spr = this.add.image(bx, GAME_H + 60, `fruit_${level}`)
        .setOrigin(0.5).setScale(scale).setDepth(6);

      // 下から飛び出すポップイン
      this.tweens.add({
        targets: spr, y: by,
        duration: 320, ease: 'Back.easeOut',
        delay: idx * 70,
      });

      // ゆらゆら浮遊
      this.time.delayedCall(320 + idx * 70, () => {
        if (!spr || !spr.scene) return;
        this.tweens.add({
          targets: spr, y: by - 8,
          yoyo: true, repeat: -1,
          duration: 820 + col * 110,
          ease: 'Sine.easeInOut',
        });
      });

      this.bottomFruits[col] = spr;
      this.bottomLevels[col] = level;
    });
  }

  // 横3マッチになるか判定（生成中の levels 配列を参照）
  _bottomWouldMatch3(levels, col, level) {
    let run = 1;
    for (let c = col - 1; c >= 0 && levels[c] === level; c--) run++;
    for (let c = col + 1; c < LANE_COUNT && levels[c] === level; c++) run++;
    return run >= 3;
  }

  _startPushTimer() {
    if (this.state === 'GAME_OVER') return;
    this.pushTimeLeft = 10;

    // バーをフル幅にリセット
    if (this.pushBar) {
      this.pushBar.setDisplaySize(GAME_W - 16, 7).setFillStyle(0xFF85B3, 1);
    }
    if (this.pushTimerText) {
      this.pushTimerText.setText('10s').setColor('#558855');
    }

    // バーのトゥイーン
    if (this.pushTimerTween) { this.pushTimerTween.stop(); this.pushTimerTween = null; }
    if (this.pushBar) {
      this.pushTimerTween = this.tweens.add({
        targets: this.pushBar,
        displayWidth: 0,
        duration: 10000,
        ease: 'Linear',
      });
    }

    if (this.pushTimer) { this.pushTimer.remove(); this.pushTimer = null; }
    this.pushTimer = this.time.addEvent({
      delay: 1000, repeat: 9,
      callback: () => {
        this.pushTimeLeft--;
        if (this.pushTimerText) {
          const warn = this.pushTimeLeft <= 3;
          this.pushTimerText.setText(`${this.pushTimeLeft}s`).setColor(warn ? '#FF1493' : '#A0407A');
          if (warn) this.pushBar && this.pushBar.setFillStyle(0xFF1493, 1);
        }
        if (this.pushTimeLeft <= 0) this._pushBottomFruits();
      },
    });
  }

  _pushBottomFruits() {
    if (this.state === 'GAME_OVER') return;
    // ドロップアニメ中なら少し待つ
    if (this.state === 'ANIMATING') {
      this.time.delayedCall(300, () => this._pushBottomFruits());
      return;
    }

    if (this.pushTimer) { this.pushTimer.remove(); this.pushTimer = null; }

    // フルーツが用意されていない場合はスキップ
    if (!this.bottomFruits || this.bottomFruits.every(s => s === null)) {
      this._initBottomFruits();
      this._startPushTimer();
      return;
    }

    // 押し上げ対象レーンのみ処理（null = 対象外）
    for (let col = 0; col < LANE_COUNT; col++) {
      if (this.bottomLevels[col] === null) continue; // このレーンはスキップ

      // 既存スプライトを1段上へ
      for (let r = 0; r < this.gridSprites[col].length; r++) {
        this.tweens.add({
          targets: this.gridSprites[col][r],
          y: this._rowY(r + 1),
          duration: 230, ease: 'Quad.easeOut',
        });
      }
      // グリッドに先頭挿入
      this.grid[col].unshift(this.bottomLevels[col]);
      this.gridSprites[col].unshift(this.bottomFruits[col]);

      // スプライトをレーン底(row=0)へアニメ
      const spr = this.bottomFruits[col];
      if (spr) {
        this.tweens.killTweensOf(spr);
        this.tweens.add({
          targets: spr,
          x: this._laneX(col), y: this._rowY(0),
          scaleX: this._fruitScale(this.bottomLevels[col]),
          scaleY: this._fruitScale(this.bottomLevels[col]),
          duration: 260, ease: 'Back.easeOut',
        });
      }
    }

    this.bottomFruits = new Array(LANE_COUNT).fill(null);
    this.bottomLevels = new Array(LANE_COUNT).fill(null);

    // 着地後：マッチ消去を先に処理 → 消えた後でゲームオーバー判定
    // （赤線を超えていてもマッチで消えればゲームオーバーにならない）
    this.time.delayedCall(380, () => {
      if (this.state === 'GAME_OVER') return;

      // 押し上げ後に位置を正しく詰め直す
      this._packAllColumns(true);

      // ── 次のバッチとタイマーは "カスケードの完了を待たずに" 即スタート。
      //    カスケードが長引く場合でも、下フルーツ・カウントダウンが
      //    途切れないようにするための保険。
      this._initBottomFruits();
      this._startPushTimer();

      // カスケード（消去・合体）を並行実行
      this._runMatchCascade(() => { this.combo = 0; }); // 押し上げカスケード後にコンボをリセット
    });
  }

  // タイマーが生きていなければ復活させる保険（見えない停止の救済）
  _ensurePushTimerAlive() {
    if (this.state === 'GAME_OVER') return;
    const timerDead =
      !this.pushTimer ||
      this.pushTimer.hasDispatched ||
      this.pushTimer.paused;
    const bottomsEmpty =
      !this.bottomFruits || this.bottomFruits.every(s => s === null);
    if (timerDead && bottomsEmpty) {
      this._initBottomFruits();
      this._startPushTimer();
    } else if (timerDead) {
      this._startPushTimer();
    }
  }

  // Step8: 次のランクまでの必要スコアを計算
  _calcNextRankPts(score) {
    for (const milestone of RANK_MILESTONES) {
      if (score < milestone) return milestone - score;
    }
    return 0; // 最高ランク到達
  }

  // ============================================================
  //  UIScene 更新
  // ============================================================
  _updateUI() {
    const ui = this.scene.get('UIScene');
    if (!ui || !ui.scoreText) return;
    ui.setScore(this.score);
    ui.setNext(this.nextLevel);
  }

  // ============================================================
  //  フィールド描画
  // ============================================================
  _drawField() {
    // ── 背景（全体）
    this.add.rectangle(GAME_W/2, GAME_H/2, GAME_W, GAME_H, 0xFFF0F8);

    // ── ヘッダー背景（ソフトローズ → 上部をやや明るくしてグラデ風）
    this.add.rectangle(GAME_W/2, HEADER_H/2, GAME_W, HEADER_H, 0xFFDEEE);
    this.add.rectangle(GAME_W/2, HEADER_H/4, GAME_W, HEADER_H/2, 0xFFF2F8, 0.55).setOrigin(0.5);

    // ── フッター背景（ソフトローズ）
    this.add.rectangle(GAME_W/2, GAME_H - FOOTER_H/2, GAME_W, FOOTER_H, 0xFFDEEE);

    // ── フィールド水玉模様（ポルカドット・超薄め）
    const dotGfx = this.add.graphics();
    const dotGap = 28;
    for (let row = 0; row * dotGap < FIELD_H + dotGap; row++) {
      const py = HEADER_H + dotGap * 0.6 + row * dotGap;
      for (let col = 0; col * dotGap < GAME_W + dotGap; col++) {
        const px = col * dotGap + (row % 2 === 0 ? 0 : dotGap / 2);
        // 大きめドット（アクセント）
        if ((row + col) % 5 === 0) {
          dotGfx.fillStyle(0xF5A0C8, 0.18);
          dotGfx.fillCircle(px, py, 4);
        } else {
          dotGfx.fillStyle(0xF0B0D0, 0.15);
          dotGfx.fillCircle(px, py, 2.2);
        }
      }
    }

    const gfx = this.add.graphics();
    // レーン区切り線（ダスティローズ）
    gfx.lineStyle(1, 0xE8A8C8, 0.7);
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = i * LANE_W;
      gfx.beginPath(); gfx.moveTo(x, HEADER_H); gfx.lineTo(x, HEADER_H + FIELD_H); gfx.strokePath();
    }
    // フィールド枠（モーブ）
    gfx.lineStyle(2, 0xD48AB0, 1);
    gfx.strokeRect(0, HEADER_H, GAME_W, FIELD_H);
    // DANGERライン（ホットピンク）
    gfx.lineStyle(2, 0xFF6BAE, 0.85);
    gfx.beginPath(); gfx.moveTo(0, DANGER_Y); gfx.lineTo(GAME_W, DANGER_Y); gfx.strokePath();

    this.dangerText = this.add.text(4, DANGER_Y + 2, window.t().danger, {
      fontSize: '9px', fontFamily: 'Arial', color: '#FF6BAE',
    });
    this.tapHintText = this.add.text(GAME_W/2, 88, window.t().tapHint, {
      fontSize: '11px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.9);

    // フッター：ラベル（動的に更新）
    this.pushCountLabel = this.add.text(10, GAME_H - FOOTER_H + 5, window.t().pushNext, {
      fontSize: '10px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 1,
    }).setDepth(5);

    // カウントダウンテキスト（右端）
    this.pushTimerText = this.add.text(GAME_W - 8, GAME_H - FOOTER_H + 5, '10s', {
      fontSize: '12px', fontFamily: 'Arial',
      color: '#A0407A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(5);

    // カウントダウンバー 背景（ライトピンク）
    this.add.rectangle(GAME_W / 2, GAME_H - FOOTER_H + 20, GAME_W - 16, 7, 0xF0C0D8, 1)
      .setOrigin(0.5);

    // カウントダウンバー 本体（ホットピンク）
    this.pushBar = this.add.rectangle(8, GAME_H - FOOTER_H + 20, GAME_W - 16, 7, 0xFF85B3, 1)
      .setOrigin(0, 0.5).setDepth(3);
  }

  // ============================================================
  //  言語切替（UIScene から呼び出す）
  // ============================================================
  updateLang() {
    const tx = window.t();
    if (this.dangerText)    this.dangerText.setText(tx.danger);
    if (this.tapHintText)   this.tapHintText.setText(tx.tapHint);
    if (this.pushCountLabel) {
      // 現在の色から pushAll / push1 / pushNext を判別して適切なテキストを設定
      const col = this.pushCountLabel.style.color;
      if (col === '#e53935' || col === '#E53935') {
        this.pushCountLabel.setText(tx.pushAll);
      } else if (col === '#1976d2' || col === '#1976D2') {
        this.pushCountLabel.setText(tx.push1);
      } else {
        this.pushCountLabel.setText(tx.pushNext);
      }
    }
  }

  // ============================================================
  //  フルーツテクスチャ生成（Step3 から変更なし）
  // ============================================================
  _buildFruitTextures() {
    FRUITS.forEach(fruit => {
      // リスタート時に既存テクスチャを上書きしない
      if (this.textures.exists(`fruit_${fruit.level}`)) return;
      const pad  = 18;
      const side = fruit.size + pad * 2;
      const tex  = this.textures.createCanvas(`fruit_${fruit.level}`, side, side);
      const ctx  = tex.context;
      const cx   = side / 2, cy = side / 2, r = fruit.size / 2;
      fruit.level === 8 ? this._drawRainbow(ctx, cx, cy, r) : this._drawStdFruit(ctx, cx, cy, r, fruit);
      tex.refresh();
    });
  }

  _drawStdFruit(ctx, cx, cy, r, fruit) {
    const bGrad = ctx.createRadialGradient(cx, cy, r*.55, cx, cy, r+14);
    bGrad.addColorStop(0,'rgba(255,255,255,0)'); bGrad.addColorStop(.75,'rgba(255,255,255,0.12)'); bGrad.addColorStop(1,'rgba(255,255,255,0.55)');
    ctx.beginPath(); ctx.arc(cx,cy,r+14,0,Math.PI*2); ctx.fillStyle=bGrad; ctx.fill();
    const fGrad=ctx.createRadialGradient(cx-r*.28,cy-r*.28,r*.04,cx,cy,r);
    fGrad.addColorStop(0,lighter(fruit.color,70)); fGrad.addColorStop(.55,fruit.color); fGrad.addColorStop(1,darker(fruit.color,45));
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=fGrad; ctx.fill();
    this._drawDetails(ctx,cx,cy,r,fruit.level,fruit.color);
    this._drawFace(ctx,cx,cy,r);
    const hGrad=ctx.createRadialGradient(cx-r*.3,cy-r*.3,0,cx-r*.3,cy-r*.3,r*.28);
    hGrad.addColorStop(0,'rgba(255,255,255,0.85)'); hGrad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx-r*.3,cy-r*.3,r*.28,0,Math.PI*2); ctx.fillStyle=hGrad; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,r+5,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=2.5; ctx.stroke();
    // Lv4以上（2個で消える）はフルーツの上に王冠を描画
    if (fruit.level >= 4) this._drawCrown(ctx, cx, cy, r);
  }

  _drawCrown(ctx, cx, cy, r) {
    const cw = Math.min(r * 0.72, 28);  // 王冠の半幅
    const ch = Math.min(r * 0.42, 16);  // 王冠の高さ
    const by = cy - r + 3;              // 王冠の底辺（フルーツ上端より少し内側）
    const ty = by - ch;                 // 王冠の最高点

    ctx.save();

    // ── ドロップシャドウ
    ctx.shadowColor = 'rgba(0,0,0,0.30)';
    ctx.shadowBlur  = 5;
    ctx.shadowOffsetY = 2;

    // ── 王冠本体（ゴールドグラデーション）
    const grad = ctx.createLinearGradient(cx, ty - ch * 0.2, cx, by);
    grad.addColorStop(0,   '#FFF176');
    grad.addColorStop(0.4, '#FFD700');
    grad.addColorStop(1,   '#F9A825');

    ctx.beginPath();
    ctx.moveTo(cx - cw, by);                               // 左下
    ctx.lineTo(cx - cw, ty + ch * 0.38);                  // 左辺 途中
    ctx.lineTo(cx - cw * 0.60, ty + ch * 0.62);           // 左谷
    ctx.lineTo(cx - cw * 0.36, ty + ch * 0.08);           // 左山
    ctx.lineTo(cx - cw * 0.12, ty + ch * 0.50);           // 中谷左
    ctx.lineTo(cx,             ty - ch * 0.18);            // 中央山（一番高い）
    ctx.lineTo(cx + cw * 0.12, ty + ch * 0.50);           // 中谷右
    ctx.lineTo(cx + cw * 0.36, ty + ch * 0.08);           // 右山
    ctx.lineTo(cx + cw * 0.60, ty + ch * 0.62);           // 右谷
    ctx.lineTo(cx + cw, ty + ch * 0.38);                  // 右辺 途中
    ctx.lineTo(cx + cw, by);                               // 右下
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // ── 縁取り
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(180,110,0,0.65)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // ── 宝石（3つ：左山・中央・右山）
    const gems = [
      { x: cx - cw * 0.36, y: ty + ch * 0.10, color: '#FF5252' },
      { x: cx,             y: ty - ch * 0.16,  color: '#4FC3F7' },
      { x: cx + cw * 0.36, y: ty + ch * 0.10, color: '#FF5252' },
    ];
    const gr = Math.max(2.2, cw * 0.10);
    gems.forEach(g => {
      ctx.beginPath();
      ctx.arc(g.x, g.y, gr, 0, Math.PI * 2);
      ctx.fillStyle = g.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    ctx.restore();
  }

  _drawDetails(ctx,cx,cy,r,level,color){
    const dk=darker(color,60);
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
    switch(level){
      case 1:{const pts=[[-r*.30,-r*.42],[r*.30,-r*.42],[0,-r*.62],[-r*.52,-r*.18],[r*.52,-r*.18]];ctx.fillStyle=dk;ctx.globalAlpha=0.38;pts.forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(cx+dx,cy+dy,r*.18,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;break;}
      case 2:{ctx.strokeStyle='rgba(0,0,0,0.11)';ctx.lineWidth=1.5;for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}ctx.fillStyle='#66BB6A';ctx.beginPath();ctx.ellipse(cx,cy-r*.82,r*.12,r*.22,0,0,Math.PI*2);ctx.fill();break;}
      case 3:{ctx.fillStyle=dk;ctx.globalAlpha=0.32;ctx.beginPath();ctx.arc(cx,cy-r*.86,r*.13,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#5D4037';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx,cy-r*.86);ctx.lineTo(cx+r*.12,cy-r*.96);ctx.stroke();ctx.fillStyle='#4CAF50';ctx.beginPath();ctx.ellipse(cx+r*.25,cy-r*.92,r*.17,r*.08,Math.PI/5,0,Math.PI*2);ctx.fill();break;}
      case 4:{ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=1;for(let i=-2;i<=2;i++){const ly=cy+i*r*.28;const hw=Math.sqrt(Math.max(0,r*r-(ly-cy)*(ly-cy)))*.82;ctx.beginPath();ctx.moveTo(cx-hw,ly);ctx.lineTo(cx+hw,ly);ctx.stroke();}ctx.fillStyle=lighter(color,20);ctx.beginPath();ctx.arc(cx,cy-r*.9,r*.1,0,Math.PI*2);ctx.fill();break;}
      case 5:{ctx.strokeStyle=dk;ctx.lineWidth=2.2;ctx.globalAlpha=0.28;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx,cy-r*.72);ctx.bezierCurveTo(cx-r*.1,cy,cx-r*.1,cy+r*.48,cx,cy+r*.72);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#66BB6A';ctx.beginPath();ctx.ellipse(cx+r*.12,cy-r*.78,r*.16,r*.08,Math.PI/3,0,Math.PI*2);ctx.fill();break;}
      case 6:{ctx.strokeStyle='rgba(0,0,0,0.13)';ctx.lineWidth=1;for(let row=-3;row<=3;row++)for(let col=-3;col<=3;col++){const px=cx+col*r*.28+(row%2===0?0:r*.14),py=cy+row*r*.28;if((px-cx)*(px-cx)+(py-cy)*(py-cy)<r*r*.72){const s=r*.11;ctx.beginPath();ctx.moveTo(px,py-s);ctx.lineTo(px+s,py);ctx.lineTo(px,py+s);ctx.lineTo(px-s,py);ctx.closePath();ctx.stroke();}}ctx.fillStyle='#388E3C';[[-r*.2,-r*.72],[0,-r*.82],[r*.2,-r*.72]].forEach(([dx,dy])=>{ctx.beginPath();ctx.ellipse(cx+dx,cy+dy,r*.06,r*.2,dx<0?-Math.PI/6:dx>0?Math.PI/6:0,0,Math.PI*2);ctx.fill();});break;}
      case 7:{ctx.strokeStyle='rgba(0,80,0,0.28)';ctx.lineWidth=r*.14;ctx.lineCap='butt';[-r*.42,0,r*.42].forEach(offset=>{ctx.beginPath();ctx.arc(cx+offset,cy,r*.78,-Math.PI*.72,Math.PI*.22);ctx.stroke();});ctx.fillStyle='#B71C1C';[[-r*.24,r*.14],[r*.24,r*.10],[0,r*.30],[-r*.08,-r*.12]].forEach(([dx,dy])=>{ctx.beginPath();ctx.ellipse(cx+dx,cy+dy,2.5,4.5,Math.PI/6,0,Math.PI*2);ctx.fill();});break;}
    }
    ctx.restore();
  }

  _drawFace(ctx,cx,cy,r){
    const eyeY=cy+r*.10,eyeR=Math.max(2.2,r*.08),eyeOX=r*.26;
    ctx.save();ctx.fillStyle='#333333';
    ctx.beginPath();ctx.arc(cx-eyeOX,eyeY,eyeR,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(cx+eyeOX,eyeY,eyeR,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,150,150,0.4)';
    ctx.beginPath();ctx.ellipse(cx-eyeOX-r*.06,eyeY+r*.14,r*.12,r*.07,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+eyeOX+r*.06,eyeY+r*.14,r*.12,r*.07,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#333333';ctx.lineWidth=Math.max(1.5,r*.065);ctx.lineCap='round';
    ctx.beginPath();ctx.arc(cx,eyeY+r*.14,r*.22,0.05,Math.PI-0.05);ctx.stroke();
    ctx.restore();
  }

  _drawRainbow(ctx,cx,cy,r){
    const bGrad=ctx.createRadialGradient(cx,cy,r*.55,cx,cy,r+14);
    bGrad.addColorStop(0,'rgba(255,255,255,0)');bGrad.addColorStop(1,'rgba(255,255,255,0.55)');
    ctx.beginPath();ctx.arc(cx,cy,r+14,0,Math.PI*2);ctx.fillStyle=bGrad;ctx.fill();
    const rGrad=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
    ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF6B6B'].forEach((c,i,a)=>rGrad.addColorStop(i/(a.length-1),c));
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=rGrad;ctx.fill();
    [[r*.58,-r*.50],[-r*.62,-r*.42],[r*.48,r*.58],[-r*.42,r*.62]].forEach(([dx,dy])=>this._drawStar(ctx,cx+dx,cy+dy,4,9));
    this._drawFace(ctx,cx,cy,r);
    const hGrad=ctx.createRadialGradient(cx-r*.3,cy-r*.3,0,cx-r*.3,cy-r*.3,r*.3);
    hGrad.addColorStop(0,'rgba(255,255,255,0.9)');hGrad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.beginPath();ctx.arc(cx-r*.3,cy-r*.3,r*.3,0,Math.PI*2);ctx.fillStyle=hGrad;ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,r+5,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=3;ctx.stroke();
  }

  _drawStar(ctx,x,y,innerR,outerR){
    ctx.save();ctx.fillStyle='rgba(255,255,255,0.92)';ctx.beginPath();
    for(let i=0;i<4;i++){const a=(i*Math.PI)/2-Math.PI/4,am=a+Math.PI/4;
      if(i===0)ctx.moveTo(x+Math.cos(a)*outerR,y+Math.sin(a)*outerR);
      else ctx.lineTo(x+Math.cos(a)*outerR,y+Math.sin(a)*outerR);
      ctx.lineTo(x+Math.cos(am)*innerR,y+Math.sin(am)*innerR);}
    ctx.closePath();ctx.fill();ctx.restore();
  }
}
