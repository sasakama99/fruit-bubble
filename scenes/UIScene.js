// ============================================================
//  UIScene — スコア・NEXT・ポーズ・音量・フィーバーバー・言語切替・リスタート
// ============================================================
class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  create() {
    this.score     = 0;
    this.bestScore = parseInt(localStorage.getItem('fruitBubbleBest') || '0', 10);
    this.soundOn   = localStorage.getItem('fruitBubbleSound') !== 'off';
    const tx = window.t();

    // ── スコア（ディープピンク）
    this.scoreText = this.add.text(14, 14, `${tx.score}: 0`, {
      fontSize: '22px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 3,
    });

    // ── ベストスコア（モーブ）
    this.bestText = this.add.text(14, 44, `${tx.best}: ${this.bestScore.toLocaleString()}`, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#B06090', stroke: '#fff', strokeThickness: 2,
    });

    // ── 言語切替ボタン（左下）
    this.langBtnText = this.add.text(14, 74, tx.langBtn, {
      fontSize: '11px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 1,
      backgroundColor: '#FFE4EE',
      padding: { x: 5, y: 2 },
    }).setInteractive({ cursor: 'pointer' });
    this.langBtnText.on('pointerover', () => this.langBtnText.setStyle({ color: '#FF6BAE' }));
    this.langBtnText.on('pointerout',  () => this.langBtnText.setStyle({ color: '#C06090' }));
    this.langBtnText.on('pointerdown', () => this._switchLang());

    // ── リスタートボタン（言語ボタンの右隣）
    this.restartBtnText = this.add.text(70, 74, tx.restartBtn, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 1,
      backgroundColor: '#FFE4EE',
      padding: { x: 5, y: 2 },
    }).setInteractive({ cursor: 'pointer' });
    this.restartBtnText.on('pointerover', () => this.restartBtnText.setStyle({ color: '#FF6BAE' }));
    this.restartBtnText.on('pointerout',  () => this.restartBtnText.setStyle({ color: '#C06090' }));
    this.restartBtnText.on('pointerdown', () => this._showRestartConfirm());

    // ── バッジボタン（ヘルプボタンの右隣）
    this.badgeBtnText = this.add.text(134, 74, tx.badgeBtn, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 1,
      backgroundColor: '#FFE4EE',
      padding: { x: 6, y: 2 },
    }).setInteractive({ cursor: 'pointer' });
    this.badgeBtnText.on('pointerover', () => this.badgeBtnText.setStyle({ color: '#FF6BAE' }));
    this.badgeBtnText.on('pointerout',  () => this.badgeBtnText.setStyle({ color: '#C06090' }));
    this.badgeBtnText.on('pointerdown', () => this._showBadgePanel());

    // ── ヘルプボタン（バッジボタンの右隣）
    this.helpBtnText = this.add.text(168, 74, tx.helpBtn, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 1,
      backgroundColor: '#FFE4EE',
      padding: { x: 6, y: 2 },
    }).setInteractive({ cursor: 'pointer' });
    this.helpBtnText.on('pointerover', () => this.helpBtnText.setStyle({ color: '#FF6BAE' }));
    this.helpBtnText.on('pointerout',  () => this.helpBtnText.setStyle({ color: '#C06090' }));
    this.helpBtnText.on('pointerdown', () => this._showHelp());

    // ── NEXT ラベル
    this.nextLabel = this.add.text(370, 12, tx.next, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#C06090', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5);

    // ── NEXT フルーツ
    this.nextImg = this.add.image(370, 62, 'fruit_1').setOrigin(0.5).setScale(0.65);

    // ── ポーズボタン（ピンク）
    const pauseBox = this.add.rectangle(448, 20, 36, 36, 0xFF8FB8, 0.9)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setOrigin(0.5);
    this.pauseLabel = this.add.text(448, 20, '||', {
      fontSize: '16px', fontFamily: 'Arial', color: '#fff',
    }).setOrigin(0.5);
    pauseBox.on('pointerover', () => pauseBox.setFillStyle(0xFFB3CE, 0.9));
    pauseBox.on('pointerout',  () => pauseBox.setFillStyle(0xFF8FB8, 0.9));
    pauseBox.on('pointerdown', () => this._togglePause());

    // ── 音量ボタン（ピンク）
    const soundBox = this.add.rectangle(448, 62, 36, 36, 0xFF8FB8, 0.9)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setOrigin(0.5);
    this.soundLabel = this.add.text(448, 62, '♪', {
      fontSize: '18px', fontFamily: 'Arial', color: '#fff',
    }).setOrigin(0.5);
    soundBox.on('pointerover', () => soundBox.setFillStyle(0xFFB3CE, 0.9));
    soundBox.on('pointerout',  () => soundBox.setFillStyle(0xFF8FB8, 0.9));
    soundBox.on('pointerdown', () => this._toggleSound());
    // 保存済み設定を即時反映
    if (!this.soundOn) {
      this.soundLabel.setText('✕');
      this.sound.setMute(true);
    }

    // ── バッジトースト受信リスナー（ゲーム中バッジ獲得通知）
    this._toastQueue  = [];
    this._toastActive = false;
    this.game.events.on('badge-unlocked', this._queueToast, this);
    this.events.once('shutdown', () => {
      this.game.events.off('badge-unlocked', this._queueToast, this);
    });

    // ── フィーバーバー（ヘッダー下端、初期は非表示）
    const GAME_W   = 480;
    const HEADER_H = 100;
    this.feverBarBg = this.add.rectangle(GAME_W/2, HEADER_H - 5, GAME_W, 8, 0xD4A0C0, 0.3)
      .setOrigin(0.5, 1).setAlpha(0);
    this.feverBar   = this.add.rectangle(0, HEADER_H - 5, GAME_W, 8, 0xFF69B4, 1)
      .setOrigin(0, 1).setAlpha(0);
    this.feverLabel = this.add.text(GAME_W/2, HEADER_H - 11, '💖 FEVER TIME 💖', {
      fontSize: '11px', fontFamily: 'Arial',
      color: '#FF69B4', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5, 1).setAlpha(0);
  }

  // ============================================================
  //  Public API（GameScene から呼び出す）
  // ============================================================
  setScore(score) {
    const tx = window.t();
    this.score = score;
    this.scoreText.setText(`${tx.score}: ${score.toLocaleString()}`);
    if (score > this.bestScore) {
      this.bestScore = score;
      localStorage.setItem('fruitBubbleBest', score);
      this.bestText.setText(`${tx.best}: ${score.toLocaleString()}`);
    }
  }

  setNext(level) {
    if (!this.nextImg || !this.nextImg.scene) return;
    this.nextImg.setTexture(`fruit_${level}`);
  }

  // フィーバーバーを表示してカウントダウン
  startFeverBar(duration) {
    const GAME_W = 480;
    this.feverBarBg.setAlpha(1);
    this.feverBar.setAlpha(1).setX(0).setDisplaySize(GAME_W, 8);
    this.feverLabel.setAlpha(1);

    if (this.feverBarTween) this.feverBarTween.stop();
    this.feverBarTween = this.tweens.add({
      targets: this.feverBar,
      displayWidth: 0,
      duration: duration * 1000,
      ease: 'Linear',
    });

    this.tweens.add({
      targets: this.feverLabel,
      alpha: { from: 1, to: 0.4 },
      yoyo: true, repeat: -1, duration: 400,
    });
  }

  endFeverBar() {
    if (this.feverBarTween) { this.feverBarTween.stop(); this.feverBarTween = null; }
    this.tweens.killTweensOf(this.feverLabel);
    this.tweens.add({
      targets: [this.feverBarBg, this.feverBar, this.feverLabel],
      alpha: 0, duration: 500,
    });
  }

  // ============================================================
  //  言語切替（リロードなし）
  // ============================================================
  _switchLang() {
    window.LANG = window.LANG === 'ja' ? 'en' : 'ja';
    localStorage.setItem('fruitBubbleLang', window.LANG);
    this.updateLang();
    const gs = this.scene.get('GameScene');
    if (gs && gs.updateLang) gs.updateLang();
  }

  updateLang() {
    const tx = window.t();
    this.scoreText.setText(`${tx.score}: ${this.score.toLocaleString()}`);
    this.bestText.setText(`${tx.best}: ${this.bestScore.toLocaleString()}`);
    this.langBtnText.setText(tx.langBtn);
    this.restartBtnText.setText(tx.restartBtn);
    this.helpBtnText.setText(tx.helpBtn);
    this.nextLabel.setText(tx.next);
  }

  // ============================================================
  //  バッジトースト通知
  // ============================================================
  _queueToast(def) {
    this._toastQueue.push(def);
    if (!this._toastActive) this._nextToast();
  }

  _nextToast() {
    if (!this._toastQueue.length) { this._toastActive = false; return; }
    this._toastActive = true;
    const def = this._toastQueue.shift();
    const lang = window.LANG || 'ja';
    const name = def.name[lang] || def.name.ja;
    const tx   = window.t();

    const W = 280, H = 52;
    const cx = 240, startY = 108, endY = 128;

    const bg = this.add.rectangle(cx, startY, W, H, 0xFF8FB8, 0.95)
      .setStrokeStyle(2, 0xFF6B9D).setDepth(90).setAlpha(0);
    const emoji = this.add.text(cx - W/2 + 20, startY, def.emoji, {
      fontSize: '22px', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(91).setAlpha(0);
    const label = this.add.text(cx + 10, startY, `${tx.badgeNew}\n${name}`, {
      fontSize: '11px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5).setDepth(91).setAlpha(0);

    const objs = [bg, emoji, label];
    this.tweens.add({
      targets: objs, alpha: 1, y: endY,
      duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: objs, alpha: 0, y: endY - 15,
            duration: 300, ease: 'Quad.easeIn',
            onComplete: () => {
              objs.forEach(o => o.destroy());
              this._nextToast();
            },
          });
        });
      },
    });
  }

  // ============================================================
  //  バッジコレクション パネル
  // ============================================================
  _showBadgePanel() {
    const tx   = window.t();
    const lang = window.LANG || 'ja';
    const gs   = this.scene.get('GameScene');
    if (gs && gs.scene) gs.scene.pause();

    const COLS   = 5;
    const CELL   = 78;   // セルサイズ
    const PAD    = 12;
    const PW     = COLS * CELL + PAD * 2;  // 414
    const badges = window.BadgeManager.getAll();
    const rows   = Math.ceil(badges.length / COLS);
    const gridH  = rows * CELL;
    const PH     = gridH + 110;
    const cx     = 240, cy = 360;

    // 暗幕
    const overlay = this.add.rectangle(cx, cy, 480, 720, 0x000000, 0)
      .setDepth(60).setInteractive();
    this.tweens.add({ targets: overlay, alpha: 0.5, duration: 300 });

    // パネル
    const panel = this.add.rectangle(cx, cy, PW, PH, 0xFFF0F8, 1)
      .setStrokeStyle(3, 0xFF8FB8).setDepth(61);

    // タイトル
    const title = this.add.text(cx, cy - PH/2 + 24, tx.badgeTitle, {
      fontSize: '16px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(62);

    // 進捗
    const earned = window.BadgeManager.earnedCount();
    const total  = window.BadgeManager.totalCount();
    const prog = this.add.text(cx, cy - PH/2 + 46, tx.badgeProgress(earned, total), {
      fontSize: '12px', fontFamily: 'Arial',
      color: '#B06090', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(62);

    // バッジグリッド
    const gridTop = cy - PH/2 + 65;
    const gridLeft = cx - (COLS * CELL) / 2;
    const cells = [];
    badges.forEach((b, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const bx  = gridLeft + col * CELL + CELL/2;
      const by  = gridTop  + row * CELL + CELL/2;

      const bgCol  = b.earned ? 0xFFD6EC : 0xE0E0E0;
      const bgRect = this.add.rectangle(bx, by, CELL - 4, CELL - 4, bgCol, 1)
        .setStrokeStyle(1, b.earned ? 0xFF8FB8 : 0xBBBBBB).setDepth(62);

      const emojiTxt = this.add.text(bx, by - 14,
        b.earned ? b.emoji : '🔒', {
          fontSize: '22px', fontFamily: 'Arial',
        }).setOrigin(0.5).setDepth(63);

      const bname = b.name[lang] || b.name.ja;
      const nameTxt = this.add.text(bx, by + 14,
        b.earned ? bname : '???', {
          fontSize: '8px', fontFamily: 'Arial',
          color: b.earned ? '#A0397A' : '#999',
          wordWrap: { width: CELL - 6 },
          align: 'center',
        }).setOrigin(0.5).setDepth(63);

      cells.push(bgRect, emojiTxt, nameTxt);
    });

    // 閉じるボタン
    const closeY = cy + PH/2 - 24;
    const closeBtn = this.add.rectangle(cx, closeY, 120, 36, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(62);
    const closeTxt = this.add.text(cx, closeY, tx.badgeClose, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(63);

    const allObjs = [overlay, panel, title, prog, closeBtn, closeTxt, ...cells];
    allObjs.forEach(o => o.setAlpha ? o.setAlpha(0) : null);
    this.tweens.add({ targets: allObjs, alpha: 1, duration: 300 });

    const _close = () => {
      this.tweens.add({
        targets: allObjs, alpha: 0, duration: 200,
        onComplete: () => {
          allObjs.forEach(o => o.destroy());
          if (gs && gs.scene) gs.scene.resume();
        },
      });
    };
    closeBtn.on('pointerdown', _close);
    overlay.on('pointerdown', _close);
  }

  // ============================================================
  //  ヘルプ（操作説明）オーバーレイ
  // ============================================================
  _showHelp() {
    const tx = window.t();

    // ゲームを一時停止
    const gs = this.scene.get('GameScene');
    const wasActive = gs && gs.scene.isActive();
    if (wasActive) gs.scene.pause();

    // 暗幕
    const overlay = this.add.rectangle(240, 360, 480, 720, 0x000000, 0.55)
      .setDepth(60).setInteractive();

    // パネル（項目数に合わせて高さを自動計算）
    const stepH  = 56;
    const itemCount = tx.howToPlay.length;
    const panelH = 80 + itemCount * stepH + 54; // ヘッダー80 + 項目 + 閉じるボタン54
    const panelY = Math.min(360, 720 - panelH / 2 - 10); // 画面下に収まるよう調整
    const panel = this.add.rectangle(240, panelY, 320, panelH, 0xFFF0F8, 1)
      .setStrokeStyle(3, 0xFF8FB8).setDepth(61);

    // タイトル
    const title = this.add.text(240, panelY - panelH/2 + 32, tx.helpTitle, {
      fontSize: '20px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(62);

    // 区切り線
    const line = this.add.rectangle(240, panelY - panelH/2 + 54, 280, 2, 0xFFB0D0, 1)
      .setOrigin(0.5, 0).setDepth(62);

    // 各ステップを描画
    const items = [];
    const startY = panelY - panelH/2 + 70;
    tx.howToPlay.forEach((text, i) => {
      const t = this.add.text(100, startY + i * stepH, text, {
        fontSize: '13px', fontFamily: 'Arial',
        color: '#555', stroke: '#fff', strokeThickness: 1,
        lineSpacing: 4,
      }).setOrigin(0, 0).setDepth(62);

      // 吹き出し風の背景（奇偶で色を交互に）
      const bg = this.add.rectangle(240, startY + i * stepH + 16, 286, 48,
        i % 2 === 0 ? 0xFFE4F4 : 0xFFF5FA, 1)
        .setStrokeStyle(1, 0xFFCCE8).setDepth(61).setOrigin(0.5);
      items.push(bg, t);
    });

    // 閉じるボタン
    const closeBox = this.add.rectangle(240, panelY + panelH/2 - 28, 160, 40, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(62);
    const closeTxt = this.add.text(240, panelY + panelH/2 - 28, tx.helpClose, {
      fontSize: '16px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(63);

    closeBox.on('pointerover', () => closeBox.setFillStyle(0xFFB3CE));
    closeBox.on('pointerout',  () => closeBox.setFillStyle(0xFF8FB8));
    closeBox.on('pointerdown', () => {
      _cleanup();
      if (wasActive) gs.scene.resume();
    });
    overlay.on('pointerdown', () => {
      _cleanup();
      if (wasActive) gs.scene.resume();
    });

    const allObjs = [overlay, panel, title, line, closeBox, closeTxt, ...items];

    // 入場アニメ
    allObjs.forEach(o => { if (o.setAlpha) o.setAlpha(0); });
    this.tweens.add({ targets: allObjs, alpha: 1, duration: 200 });

    const _cleanup = () => {
      this.tweens.add({
        targets: allObjs, alpha: 0, duration: 150,
        onComplete: () => allObjs.forEach(o => o.destroy()),
      });
    };
  }

  // ============================================================
  //  リスタート確認ダイアログ
  // ============================================================
  _showRestartConfirm() {
    const tx = window.t();

    // 暗幕
    const overlay = this.add.rectangle(240, 360, 480, 720, 0x000000, 0.5)
      .setDepth(50).setInteractive();

    // パネル
    const panel = this.add.rectangle(240, 360, 300, 170, 0xFFF0F8, 1)
      .setStrokeStyle(3, 0xFF8FB8).setDepth(51);

    // メッセージ
    const msg = this.add.text(240, 320, tx.restartConfirm, {
      fontSize: '18px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52);

    // Yes ボタン
    const yesBox = this.add.rectangle(190, 375, 110, 44, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(52);
    const yesTxt = this.add.text(190, 375, tx.restartYes, {
      fontSize: '16px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(53);
    yesBox.on('pointerover', () => yesBox.setFillStyle(0xFFB3CE));
    yesBox.on('pointerout',  () => yesBox.setFillStyle(0xFF8FB8));
    yesBox.on('pointerdown', () => {
      _cleanup();
      window.location.reload();
    });

    // No ボタン
    const noBox = this.add.rectangle(310, 375, 110, 44, 0xF0F0F0, 1)
      .setStrokeStyle(2, 0xCCCCCC).setInteractive({ cursor: 'pointer' }).setDepth(52);
    const noTxt = this.add.text(310, 375, tx.restartNo, {
      fontSize: '16px', fontFamily: 'Arial',
      color: '#555', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(53);
    noBox.on('pointerover', () => noBox.setFillStyle(0xE0E0E0));
    noBox.on('pointerout',  () => noBox.setFillStyle(0xF0F0F0));
    noBox.on('pointerdown', () => _cleanup());

    const _cleanup = () => {
      overlay.destroy();
      panel.destroy();
      msg.destroy();
      yesBox.destroy(); yesTxt.destroy();
      noBox.destroy();  noTxt.destroy();
    };
  }

  // ============================================================
  //  ポーズ / 音量トグル
  // ============================================================
  _togglePause() {
    const gs = this.scene.get('GameScene');
    if (!gs) return;
    if (gs.scene.isActive()) {
      gs.scene.pause();
      this.pauseLabel.setText('▶');
      this._showPauseOverlay();
    } else {
      gs.scene.resume();
      this.pauseLabel.setText('||');
      if (this.pauseOverlay) { this.pauseOverlay.destroy(); this.pauseOverlay = null; }
      if (this.pauseTxt)     { this.pauseTxt.destroy();     this.pauseTxt     = null; }
    }
  }

  _showPauseOverlay() {
    const tx = window.t();
    this.pauseOverlay = this.add.rectangle(240, 360, 480, 720, 0x000000, 0.45).setDepth(40);
    this.pauseTxt     = this.add.text(240, 360, tx.paused, {
      fontSize: '40px', fontFamily: 'Arial',
      color: '#fff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(41);
  }

  _toggleSound() {
    this.soundOn = !this.soundOn;
    localStorage.setItem('fruitBubbleSound', this.soundOn ? 'on' : 'off');
    this.soundLabel.setText(this.soundOn ? '♪' : '✕');
    this.sound.setMute(!this.soundOn);
  }
}
