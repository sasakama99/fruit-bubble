// ============================================================
//  RankingScene — オンラインランキング表示
//  GameScene / UIScene の上に overlay として launch される
// ============================================================
class RankingScene extends Phaser.Scene {
  constructor() { super({ key: 'RankingScene' }); }

  init(data) {
    this.myScore    = data.myScore    ?? null;
    this.initPeriod = data.period     ?? 'daily';
  }

  create() {
    const W = 480, H = 720;
    const tx = window.t();
    this.currentPeriod = this.initPeriod;

    // ── 暗幕
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6).setDepth(0)
      .setInteractive();  // クリック貫通防止

    // ── パネル
    const panelW = 400, panelH = 530;
    const panelY = H / 2;
    this.panel = this.add.rectangle(W/2, panelY, panelW, panelH, 0xFFF0F8, 1)
      .setStrokeStyle(4, 0xFF8FB8).setDepth(1);

    // タイトル
    this.add.text(W/2, panelY - panelH/2 + 28, tx.rankingTitle, {
      fontSize: '22px', fontFamily: 'Arial Black, Arial',
      color: '#D81B60', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);

    // ── タブ（デイリー / ウィークリー / マンスリー）
    const tabs     = ['daily', 'weekly', 'monthly'];
    const tabNames = [tx.rankingDaily, tx.rankingWeekly, tx.rankingMonthly];
    const tabY     = panelY - panelH/2 + 62;
    const tabW     = 110, tabH = 30;
    this._tabBtns  = [];

    tabs.forEach((period, i) => {
      const tx2 = W/2 - 120 + i * 120;
      const box = this.add.rectangle(tx2, tabY, tabW, tabH, 0xFF8FB8, 1)
        .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(2);
      const lbl = this.add.text(tx2, tabY, tabNames[i], {
        fontSize: '14px', fontFamily: 'Arial', fontStyle: 'bold',
        color: '#fff', stroke: '#C0006A', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(3);
      box.on('pointerdown', () => this._switchPeriod(period));
      this._tabBtns.push({ box, lbl, period });
    });

    // ── リスト表示エリア
    this._listY  = panelY - panelH/2 + 90;
    this._listH  = panelH - 150;
    this._listContainer = this.add.container(0, 0).setDepth(2);

    // ── 閉じるボタン
    const closeY = panelY + panelH/2 - 28;
    const closeBtn = this.add.rectangle(W/2, closeY, 160, 38, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(2);
    this.add.text(W/2, closeY, tx.rankingClose, {
      fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xFFB3CE));
    closeBtn.on('pointerout',  () => closeBtn.setFillStyle(0xFF8FB8));
    closeBtn.on('pointerdown', () => this.scene.stop('RankingScene'));

    // 初期タブ
    this._switchPeriod(this.initPeriod);
  }

  _switchPeriod(period) {
    this.currentPeriod = period;

    // タブの見た目を更新
    this._tabBtns.forEach(({ box, lbl, period: p }) => {
      const active = p === period;
      box.setFillStyle(active ? 0xFF4081 : 0xFF8FB8);
      lbl.setStyle({ color: active ? '#FFE0EF' : '#fff' });
    });

    this._showLoading();
    this._loadRanking(period);
  }

  _showLoading() {
    const tx = window.t();
    this._listContainer.removeAll(true);
    // ← container に追加することで _loadRanking 時に確実に削除される
    const t = this.add.text(480/2, this._listY + this._listH/2, tx.rankingLoading, {
      fontSize: '16px', fontFamily: 'Arial', color: '#999',
    }).setOrigin(0.5).setDepth(3);
    this._listContainer.add(t);
  }

  async _loadRanking(period) {
    const tx = window.t();
    let rows = null;

    try {
      rows = await window.RankingAPI.fetch(period, this.myScore);
    } catch (e) {
      rows = null;
    }

    // まだ別のperiodに切り替わっていたら描画しない
    if (this.currentPeriod !== period) return;

    this._listContainer.removeAll(true);
    // 既存の一時テキストも消す
    this.children.list
      .filter(c => c._rankTmp)
      .forEach(c => c.destroy());

    if (!window.FB_READY) {
      this._showMsg('Firebase 未設定');
      return;
    }
    if (!rows || rows.length === 0) {
      this._showMsg(tx.rankingEmpty);
      return;
    }

    const W     = 480;
    const rowH  = Math.min(38, this._listH / 10);
    const startY = this._listY + 6;

    rows.forEach((r, i) => {
      const y     = startY + i * rowH;
      const isYou = r.isYou;

      // 行背景（自分は強調）
      const rowBg = this.add.rectangle(W/2, y + rowH/2, 360, rowH - 4,
        isYou ? 0xFFCCE5 : (i % 2 === 0 ? 0xFFF8FC : 0xFFEDF6), 1
      ).setDepth(2);
      this._listContainer.add(rowBg);

      // 順位
      const rankEmoji = ['🥇', '🥈', '🥉'][i] || `${r.rank}.`;
      const rankTxt = this.add.text(W/2 - 165, y + rowH/2, rankEmoji, {
        fontSize: '15px', fontFamily: 'Arial',
        color: i < 3 ? '#D81B60' : '#555',
      }).setOrigin(0, 0.5).setDepth(3);
      this._listContainer.add(rankTxt);

      // 名前
      const nameTxt = this.add.text(W/2 - 125, y + rowH/2,
        r.name + (isYou ? ` ${tx.rankingYou}` : ''), {
        fontSize: '14px', fontFamily: 'Arial',
        fontStyle: isYou ? 'bold' : 'normal',
        color: isYou ? '#D81B60' : '#333',
      }).setOrigin(0, 0.5).setDepth(3);
      this._listContainer.add(nameTxt);

      // スコア（右寄せ）
      const scoreTxt = this.add.text(W/2 + 170, y + rowH/2,
        r.score.toLocaleString(), {
        fontSize: '14px', fontFamily: 'Arial Black, Arial',
        fontStyle: 'bold',
        color: isYou ? '#D81B60' : '#444',
      }).setOrigin(1, 0.5).setDepth(3);
      this._listContainer.add(scoreTxt);
    });
  }

  _showMsg(msg) {
    const t = this.add.text(480/2, this._listY + this._listH/2, msg, {
      fontSize: '15px', fontFamily: 'Arial', color: '#999',
    }).setOrigin(0.5).setDepth(3);
    t._rankTmp = true;
  }
}
