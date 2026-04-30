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

    // ── スコア（大きく・鮮やか）
    this.scoreText = this.add.text(12, 8, `${tx.score}: 0`, {
      fontSize: '26px', fontFamily: 'Arial Black, Arial',
      color: '#D81B60', stroke: '#fff', strokeThickness: 4,
    });

    // ── ベストスコア
    this.bestText = this.add.text(12, 46, `${tx.best}: ${this.bestScore.toLocaleString()}`, {
      fontSize: '15px', fontFamily: 'Arial',
      color: '#AD1457', stroke: '#fff', strokeThickness: 2,
    });

    // ── ボタン共通スタイル（y=74）
    const _btn = (x, label, onClick) => {
      const b = this.add.text(x, 74, label, {
        fontSize: '15px', fontFamily: 'Arial',
        color: '#fff', stroke: '#C0006A', strokeThickness: 2,
        backgroundColor: '#F06292',
        padding: { x: 7, y: 4 },
      }).setInteractive({ cursor: 'pointer' });
      b.on('pointerover', () => b.setStyle({ backgroundColor: '#FF80AB' }));
      b.on('pointerout',  () => b.setStyle({ backgroundColor: '#F06292' }));
      b.on('pointerdown', onClick);
      return b;
    };

    this.langBtnText     = _btn(  8, tx.langBtn,     () => this._switchLang());
    this.restartBtnText  = _btn( 60, tx.restartBtn,  () => this._showRestartConfirm());
    this.badgeBtnText    = _btn( 96, tx.badgeBtn,    () => this._showBadgePanel());
    this.rankingBtnText  = _btn(130, tx.rankingBtn,  () => this._showRanking());
    this.helpBtnText     = _btn(162, tx.helpBtn,     () => this._showHelp());
    this.settingsBtnText = _btn(196, tx.settingsBtn, () => this._showSettings());

    // ── ポーズ・音量ボタン（横並び・右端）
    const _iconBtn = (x, y, label, fontSize, onDown) => {
      const box = this.add.rectangle(x, y, 40, 40, 0xFF4081, 1)
        .setStrokeStyle(2, 0xC2185B).setInteractive({ cursor: 'pointer' }).setOrigin(0.5);
      const txt = this.add.text(x, y, label, {
        fontSize, fontFamily: 'Arial', color: '#fff',
        stroke: '#9C0042', strokeThickness: 2,
      }).setOrigin(0.5);
      box.on('pointerover', () => box.setFillStyle(0xFF80AB));
      box.on('pointerout',  () => box.setFillStyle(0xFF4081));
      box.on('pointerdown', onDown);
      return { box, txt };
    };

    // ── NEXT エリア（排出フルーツx=240 と 一時停止x=415 の中間 = x=327）
    this.add.rectangle(327, 50, 74, 88, 0xFFB3D9, 0.45)
      .setStrokeStyle(2, 0xFF6BAE).setOrigin(0.5);

    this.nextLabel = this.add.text(327, 14, tx.next, {
      fontSize: '15px', fontFamily: 'Arial Black, Arial',
      color: '#C2185B', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5);

    this.nextImg = this.add.image(327, 57, 'fruit_1').setOrigin(0.5).setScale(0.65);

    // ── ポーズ・音量ボタン（横並び・右端）
    const pause = _iconBtn(415, 50, '||', '17px', () => this._togglePause());
    this.pauseLabel = pause.txt;
    this.pauseBox   = pause.box;

    const sound = _iconBtn(460, 50, '♪', '20px', () => this._toggleSound());
    this.soundLabel = sound.txt;
    this.soundBox   = sound.box;

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

  setNext(texKey) {
    if (!this.nextImg || !this.nextImg.scene) return;
    if (this.textures && this.textures.exists(texKey)) {
      this.nextImg.setTexture(texKey);
    }
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
      this.sound.setMute(true);   // ポーズ中は設定に関係なくBGMミュート
      this._showPauseOverlay();
    } else {
      gs.scene.resume();
      this.pauseLabel.setText('||');
      this.sound.setMute(!this.soundOn);  // ユーザーの音量設定に戻す
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

  // ============================================================
  //  設定パネル（リセット系）
  // ============================================================
  _showSettings() {
    const tx = window.t();
    const gs = this.scene.get('GameScene');
    if (gs && gs.scene.isActive()) gs.scene.pause();

    const cx = 240, cy = 360;

    // 暗幕
    const overlay = this.add.rectangle(cx, cy, 480, 720, 0x000000, 0.55)
      .setDepth(70).setInteractive();

    // パネル
    const panel = this.add.rectangle(cx, cy, 300, 300, 0xFFF0F8, 1)
      .setStrokeStyle(3, 0xFF8FB8).setDepth(71);

    // タイトル
    const title = this.add.text(cx, cy - 90, tx.settingsTitle, {
      fontSize: '18px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(72);

    // 注意文言
    const note = this.add.text(cx, cy - 60, '⚠ リセットは取り消せません', {
      fontSize: '11px', fontFamily: 'Arial',
      color: '#999',
    }).setOrigin(0.5).setDepth(72);

    // ── ベストスコアリセットボタン
    const bestBtn = this.add.rectangle(cx, cy - 18, 240, 46, 0xFFE0E0, 1)
      .setStrokeStyle(2, 0xFFAAAA).setInteractive({ cursor: 'pointer' }).setDepth(72);
    const bestTxt = this.add.text(cx, cy - 18, tx.resetBestBtn, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#C0392B', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(73);
    bestBtn.on('pointerover', () => bestBtn.setFillStyle(0xFFCCCC));
    bestBtn.on('pointerout',  () => bestBtn.setFillStyle(0xFFE0E0));
    bestBtn.on('pointerdown', () => {
      this._showResetConfirm(
        tx.resetBestBtn,
        () => {
          localStorage.removeItem('fruitBubbleBest');
          this.bestScore = 0;
          this.bestText.setText(`${tx.best}: 0`);
          _showDone(tx.resetDone);
        },
        allObjs
      );
    });

    // ── バッジリセットボタン
    const badgeBtn = this.add.rectangle(cx, cy + 40, 240, 46, 0xFFE0E0, 1)
      .setStrokeStyle(2, 0xFFAAAA).setInteractive({ cursor: 'pointer' }).setDepth(72);
    const badgeTxt = this.add.text(cx, cy + 40, tx.resetBadgesBtn, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#C0392B', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(73);
    badgeBtn.on('pointerover', () => badgeBtn.setFillStyle(0xFFCCCC));
    badgeBtn.on('pointerout',  () => badgeBtn.setFillStyle(0xFFE0E0));
    badgeBtn.on('pointerdown', () => {
      this._showResetConfirm(
        tx.resetBadgesBtn,
        () => {
          localStorage.removeItem('fruitBubbleBadges');
          if (window.BadgeManager && window.BadgeManager.reset) window.BadgeManager.reset();
          _showDone(tx.resetDone);
        },
        allObjs
      );
    });

    // ── プレイヤー名変更ボタン
    let _nameInp = null, _nameSaveBtn = null;  // DOM要素の参照（パネル閉鎖時に削除用）
    const _removeNameDom = () => {
      if (_nameInp)     { _nameInp.remove();     _nameInp = null; }
      if (_nameSaveBtn) { _nameSaveBtn.remove();  _nameSaveBtn = null; }
    };

    const savedName = localStorage.getItem('fruitBubblePlayerName') || '';
    const nameLabel = savedName ? `👤 名前変更（${savedName}）` : '👤 プレイヤー名を設定';
    const nameBtn = this.add.rectangle(cx, cy + 98, 240, 46, 0xE8F4FD, 1)
      .setStrokeStyle(2, 0x90CAF9).setInteractive({ cursor: 'pointer' }).setDepth(72);
    const nameTxt = this.add.text(cx, cy + 98, nameLabel, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#1565C0', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(73);
    nameBtn.on('pointerover', () => nameBtn.setFillStyle(0xBBDEFB));
    nameBtn.on('pointerout',  () => nameBtn.setFillStyle(0xE8F4FD));
    nameBtn.on('pointerdown', () => {
      if (_nameInp) return;  // 既に表示中なら無視
      // DOM input で名前入力
      const canvas = this.game.canvas;
      const rect   = canvas.getBoundingClientRect();
      const scaleX = rect.width  / 480;
      const scaleY = rect.height / 720;

      const inp = document.createElement('input');
      inp.type        = 'text';
      inp.maxLength   = 8;
      inp.value       = localStorage.getItem('fruitBubblePlayerName') || '';
      inp.placeholder = 'プレイヤー名（8文字以内）';
      inp.style.cssText = [
        `position:fixed`,
        `left:${rect.left + 90 * scaleX}px`,
        `top:${rect.top  + (cy + 98 + 2) * scaleY}px`,
        `width:${140 * scaleX}px`,
        `height:${32 * scaleY}px`,
        `font-size:${14 * Math.min(scaleX, scaleY)}px`,
        `border:2px solid #90CAF9`,
        `border-radius:8px`,
        `padding:0 6px`,
        `text-align:center`,
        `outline:none`,
        `z-index:9999`,
      ].join(';');

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '保存';
      saveBtn.style.cssText = [
        `position:fixed`,
        `left:${rect.left + 238 * scaleX}px`,
        `top:${rect.top  + (cy + 98 + 2) * scaleY}px`,
        `width:${56 * scaleX}px`,
        `height:${32 * scaleY}px`,
        `font-size:${13 * Math.min(scaleX, scaleY)}px`,
        `background:#1565C0`,
        `color:#fff`,
        `border:none`,
        `border-radius:8px`,
        `cursor:pointer`,
        `font-weight:bold`,
        `z-index:9999`,
      ].join(';');

      document.body.appendChild(inp);
      document.body.appendChild(saveBtn);
      _nameInp = inp;
      _nameSaveBtn = saveBtn;
      nameBtn.disableInteractive();
      inp.focus();
      inp.select();

      const doSave = () => {
        const oldName = localStorage.getItem('fruitBubblePlayerName') || '';
        const newName = (inp.value || '').trim();
        if (newName) {
          localStorage.setItem('fruitBubblePlayerName', newName);
          nameTxt.setText(`👤 名前変更（${newName}）`);
          _showDone(`「${newName}」で保存しました`);
          // ランキング内の旧名も更新
          if (window.RankingAPI && oldName && oldName !== newName) {
            window.RankingAPI.renamePlayer(oldName, newName);
          }
        } else {
          localStorage.removeItem('fruitBubblePlayerName');
          nameTxt.setText('👤 プレイヤー名を設定');
          _showDone('プレイヤー名を削除しました');
        }
        _removeNameDom();
        nameBtn.setInteractive({ cursor: 'pointer' });
      };
      saveBtn.addEventListener('click', doSave);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    });

    // 閉じるボタン
    const closeBtn = this.add.rectangle(cx, cy + 158, 120, 36, 0xDDDDDD, 1)
      .setStrokeStyle(2, 0xBBBBBB).setInteractive({ cursor: 'pointer' }).setDepth(72);
    const closeTxt = this.add.text(cx, cy + 158, tx.settingsClose, {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#555', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(73);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xCCCCCC));
    closeBtn.on('pointerout',  () => closeBtn.setFillStyle(0xDDDDDD));

    const allObjs = [overlay, panel, title, note,
                     bestBtn, bestTxt, badgeBtn, badgeTxt,
                     nameBtn, nameTxt, closeBtn, closeTxt];

    const _close = () => {
      _removeNameDom();  // DOM入力欄が残っていれば削除
      this.tweens.add({
        targets: allObjs, alpha: 0, duration: 200,
        onComplete: () => {
          allObjs.forEach(o => { if (o && o.scene) o.destroy(); });
          if (gs && gs.scene) gs.scene.resume();
        },
      });
    };
    closeBtn.on('pointerdown', _close);
    overlay.on('pointerdown', _close);

    // 完了メッセージ（一時的に表示）
    const _showDone = (msg) => {
      const done = this.add.text(cx, cy - 60, `✅ ${msg}`, {
        fontSize: '13px', fontFamily: 'Arial',
        color: '#27AE60', stroke: '#fff', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(75).setAlpha(0);
      note.setAlpha(0);
      this.tweens.add({
        targets: done, alpha: 1, duration: 200,
        onComplete: () => {
          this.time.delayedCall(1500, () => {
            this.tweens.add({
              targets: done, alpha: 0, duration: 300,
              onComplete: () => { if (done && done.scene) done.destroy(); note.setAlpha(1); },
            });
          });
        },
      });
    };

    allObjs.forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: allObjs, alpha: 1, duration: 200 });
  }

  // リセット確認ダイアログ（2段階目）
  _showResetConfirm(label, onConfirm, parentObjs) {
    const tx = window.t();
    const cx = 240, cy = 360;

    // 親パネルを一時的に操作不能に
    parentObjs.forEach(o => { if (o.disableInteractive) o.disableInteractive(); });

    // 確認パネル
    const overlay2 = this.add.rectangle(cx, cy, 480, 720, 0x000000, 0.35)
      .setDepth(80).setInteractive();
    const panel2 = this.add.rectangle(cx, cy, 280, 180, 0xFFF8F8, 1)
      .setStrokeStyle(3, 0xFF6666).setDepth(81);
    const msg = this.add.text(cx, cy - 44, tx.resetConfirm(label), {
      fontSize: '14px', fontFamily: 'Arial',
      color: '#C0392B', stroke: '#fff', strokeThickness: 1,
      align: 'center',
    }).setOrigin(0.5).setDepth(82);

    // 「リセットする」（赤・左）
    const yesBtn = this.add.rectangle(cx - 64, cy + 46, 110, 40, 0xFF4444, 1)
      .setStrokeStyle(2, 0xCC0000).setInteractive({ cursor: 'pointer' }).setDepth(82);
    const yesTxt = this.add.text(cx - 64, cy + 46, tx.resetYes, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#fff', stroke: '#800000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(83);

    // 「キャンセル」（グレー・右）
    const noBtn = this.add.rectangle(cx + 64, cy + 46, 110, 40, 0xEEEEEE, 1)
      .setStrokeStyle(2, 0xBBBBBB).setInteractive({ cursor: 'pointer' }).setDepth(82);
    const noTxt = this.add.text(cx + 64, cy + 46, tx.resetNo, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#555', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(83);

    const confirmObjs = [overlay2, panel2, msg, yesBtn, yesTxt, noBtn, noTxt];

    const _closeConfirm = () => {
      this.tweens.add({
        targets: confirmObjs, alpha: 0, duration: 150,
        onComplete: () => {
          confirmObjs.forEach(o => { if (o && o.scene) o.destroy(); });
          // 親パネルを再び操作可能に
          parentObjs.forEach(o => { if (o.setInteractive) o.setInteractive({ cursor: 'pointer' }); });
        },
      });
    };

    yesBtn.on('pointerover', () => yesBtn.setFillStyle(0xFF6666));
    yesBtn.on('pointerout',  () => yesBtn.setFillStyle(0xFF4444));
    yesBtn.on('pointerdown', () => { _closeConfirm(); onConfirm(); });
    noBtn.on('pointerover',  () => noBtn.setFillStyle(0xDDDDDD));
    noBtn.on('pointerout',   () => noBtn.setFillStyle(0xEEEEEE));
    noBtn.on('pointerdown',  () => _closeConfirm());
    overlay2.on('pointerdown', () => _closeConfirm());

    confirmObjs.forEach(o => o.setAlpha(0));
    this.tweens.add({ targets: confirmObjs, alpha: 1, duration: 150 });
  }

  // ── ランキング表示 ─────────────────────────────────────────
  _showRanking() {
    if (this.scene.isActive('RankingScene')) return;
    const gs = this.scene.get('GameScene');
    const myScore = gs ? gs.score : null;
    this.scene.launch('RankingScene', { myScore, period: 'daily' });
  }
}
