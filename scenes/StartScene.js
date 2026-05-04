// ============================================================
//  StartScene — タイトル画面
//  起動時に表示。PLAYボタン押下 → 広告 → GameScene開始
// ============================================================
class StartScene extends Phaser.Scene {
  constructor() { super({ key: 'StartScene' }); }

  create() {
    const W = 480, H = 720;

    // ── 背景グラデーション
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xC9A0DC, 0xE8A0C0, 0xE8A0C0, 0xF4B8D0, 1);
    bg.fillRect(0, 0, W, H);

    // ── フルーツ装飾（散りばめる）
    const fruits = ['🍓','🍇','🍊','🍋','🍎','🍍','🍉','🍑'];
    [
      [45, 65, 32], [435, 85, 28], [22, 250, 26],
      [458, 220, 30], [55, 580, 28], [425, 555, 32],
      [180, 670, 22], [330, 658, 26],
    ].forEach(([x, y, sz], i) => {
      this.add.text(x, y, fruits[i % 8], { fontSize: `${sz}px` })
        .setOrigin(0.5).setAlpha(0.28);
    });

    // ── メインパネル
    this.add.rectangle(W/2, H/2 - 60, 420, 295, 0xFFFFFF, 0.88)
      .setStrokeStyle(4, 0xFF8FB8);

    // タイトルアイコン
    this.add.text(W/2, H/2 - 188, '🍓🍇🍊', { fontSize: '44px' }).setOrigin(0.5);

    // ゲーム名
    this.add.text(W/2, H/2 - 122, 'Fruit Bubble Pop', {
      fontSize: '27px', fontFamily: 'Arial Black, Arial',
      color: '#D81B60', stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W/2, H/2 - 80, 'Match 3 Puzzle', {
      fontSize: '17px', fontFamily: 'Arial',
      color: '#A0397A',
    }).setOrigin(0.5);

    // ハイスコア or キャッチコピー
    const best = parseInt(localStorage.getItem('fruitBubbleBest') || '0');
    this.add.text(W/2, H/2 - 40,
      best > 0
        ? `🏆 Best: ${best.toLocaleString()} pt`
        : 'Drop fruits · Match 3 · Chain Combos!', {
      fontSize: '14px', fontFamily: 'Arial',
      color: best > 0 ? '#C0006A' : '#777',
      stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5);

    // ── PLAY ボタン（メイン）
    const btnY = H/2 + 100;
    const btn = this.add.rectangle(W/2, btnY, 250, 70, 0xFF4081, 1)
      .setStrokeStyle(4, 0xC2185B)
      .setInteractive({ cursor: 'pointer' });
    const btnTxt = this.add.text(W/2, btnY, '▶  PLAY', {
      fontSize: '30px', fontFamily: 'Arial Black, Arial',
      color: '#fff', stroke: '#9C0042', strokeThickness: 3,
    }).setOrigin(0.5);

    // パルスアニメ
    this.tweens.add({
      targets: [btn, btnTxt],
      scaleX: 1.06, scaleY: 1.06,
      yoyo: true, repeat: -1,
      duration: 800, ease: 'Sine.easeInOut',
    });

    btn.on('pointerover', () => btn.setFillStyle(0xFF6B9D));
    btn.on('pointerout',  () => btn.setFillStyle(0xFF4081));
    btn.on('pointerdown', () => {
      btn.disableInteractive();
      this.tweens.killTweensOf([btn, btnTxt]);
      btn.setScale(1).setFillStyle(0xFFB3CE);
      btnTxt.setScale(1);

      const startGame = () => this.scene.start('GameScene');

      // PLAYボタン押下時にインタースティシャル広告を表示
      if (typeof sdk !== 'undefined' && sdk.showInterstitial) {
        sdk.showInterstitial(startGame);
      } else {
        startGame();
      }
    });

    // ── ランキングボタン
    const rankY = btnY + 80;
    const rankBox = this.add.rectangle(W/2, rankY, 180, 38, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' });
    this.add.text(W/2, rankY, '🏆 Ranking', {
      fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5);
    rankBox.on('pointerover', () => rankBox.setFillStyle(0xFFB3CE));
    rankBox.on('pointerout',  () => rankBox.setFillStyle(0xFF8FB8));
    rankBox.on('pointerdown', () => {
      this.scene.launch('RankingScene', { myScore: null, period: 'daily' });
    });

    // ── 言語切替ボタン（右上）
    const langBtn = this.add.text(W - 12, 12,
      window.LANG === 'en' ? '🌐 JP' : '🌐 EN', {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
      backgroundColor: '#F06292',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setInteractive({ cursor: 'pointer' });
    langBtn.on('pointerdown', () => {
      window.LANG = window.LANG === 'en' ? 'ja' : 'en';
      localStorage.setItem('fruitBubbleLang', window.LANG);
      this.scene.restart();
    });
  }
}
