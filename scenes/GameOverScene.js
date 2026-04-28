// ============================================================
//  GameOverScene — 多言語対応版
// ============================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super({ key: 'GameOverScene' }); }

  init(data) {
    this.finalScore      = data.score            || 0;
    this.bestScore       = data.bestScore        || 0;
    this.nextRankPts     = data.nextRankPts      || 0;
    this.reviveAvailable = data.reviveAvailable  !== false;
  }

  create() {
    const tx = window.t();

    // 現在ランクを計算
    let currentRank = tx.ranks[0];
    for (const r of tx.ranks) {
      if (this.finalScore >= r.threshold) currentRank = r;
      else break;
    }

    // 暗幕
    const overlay = this.add.rectangle(240, 360, 480, 720, 0x000000, 0).setDepth(0);
    this.tweens.add({ targets: overlay, alpha: 0.5, duration: 400 });

    // パネル（下から飛び上がる）
    const panel = this.add.rectangle(240, 900, 340, 490, 0xFFF0F8, 1)
      .setStrokeStyle(4, 0xFF8FB8).setDepth(1);
    this.tweens.add({
      targets: panel, y: 360,
      duration: 450, ease: 'Back.easeOut',
    });

    this.time.delayedCall(200, () => this._buildUI(currentRank, panel, tx));
  }

  _buildUI(rank, panel, tx) {
    const isNewBest = this.finalScore >= this.bestScore;

    // ゲームオーバータイトル
    const title = this.add.text(240, 175, tx.gameOver, {
      fontSize: '30px', fontFamily: 'Arial',
      color: '#E53935', stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300 });

    // ランク表示
    const rankTxt = this.add.text(240, 222, `${rank.emoji} ${rank.name}`, {
      fontSize: '22px', fontFamily: 'Arial',
      color: '#A0397A', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: rankTxt, alpha: 1, duration: 300, delay: 100 });

    // スコア（カウントアップアニメ）
    const scoreLabel = this.add.text(240, 265, `${tx.score}: 0`, {
      fontSize: '26px', fontFamily: 'Arial',
      color: '#333', stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: scoreLabel, alpha: 1, duration: 200, delay: 150 });

    const target = this.finalScore;
    this.time.delayedCall(250, () => {
      if (target <= 0) {
        scoreLabel.setText(`${tx.score}: 0`);
        return;
      }
      const dur   = Math.max(200, Math.min(1200, target / 10));
      let current = 0;
      const step  = Math.ceil(target / (dur / 16));
      this.time.addEvent({
        delay: 16, repeat: Math.floor(dur / 16),
        callback: () => {
          current = Math.min(current + step, target);
          scoreLabel.setText(`${tx.score}: ${current.toLocaleString()}`);
        }
      });
    });

    // ベストスコア
    const bestColor = isNewBest ? '#FF6B00' : '#555';
    const bestStr   = isNewBest
      ? `🏆 ${tx.best === 'Best' ? 'NEW BEST' : 'NEW BEST'}: ${this.bestScore.toLocaleString()}`
      : `${tx.best}: ${this.bestScore.toLocaleString()}`;
    const bestTxt = this.add.text(240, 308, bestStr, {
      fontSize: '17px', fontFamily: 'Arial',
      color: bestColor, stroke: '#fff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
    this.tweens.add({ targets: bestTxt, alpha: 1, duration: 300, delay: 400 });

    if (isNewBest) {
      this.tweens.add({
        targets: bestTxt,
        scaleX: { from: 0.8, to: 1.05 }, scaleY: { from: 0.8, to: 1.05 },
        yoyo: true, repeat: 2, duration: 200, delay: 600, ease: 'Sine.easeInOut',
      });
    }

    // 次のランクまで
    if (this.nextRankPts > 0) {
      const nextTxt = this.add.text(240, 345, tx.nextRank(this.nextRankPts), {
        fontSize: '13px', fontFamily: 'Arial',
        color: '#666', stroke: '#fff', strokeThickness: 1,
      }).setOrigin(0.5).setDepth(2).setAlpha(0);
      this.tweens.add({ targets: nextTxt, alpha: 1, duration: 300, delay: 500 });
    }

    // ── リバイブボタン（動画広告で復活）— 1プレイ1回限り
    const reviveY = 398;
    const revBtnColor = this.reviveAvailable ? 0xF9A825 : 0xBDBDBD;
    const revBtn = this.add.rectangle(240, reviveY, 260, 50, revBtnColor, 1)
      .setStrokeStyle(2, this.reviveAvailable ? 0xF57F17 : 0x9E9E9E)
      .setDepth(2).setAlpha(0);
    if (this.reviveAvailable) revBtn.setInteractive({ cursor: 'pointer' });

    const revBtnLabel = this.reviveAvailable ? tx.reviveBtn : '📺 復活は1プレイ1回のみ';
    const revBtnTxt = this.add.text(240, reviveY, revBtnLabel, {
      fontSize: this.reviveAvailable ? '15px' : '12px', fontFamily: 'Arial',
      color: this.reviveAvailable ? '#fff' : '#aaa',
      stroke: this.reviveAvailable ? '#5D4037' : '#888', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: [revBtn, revBtnTxt], alpha: 1, duration: 300, delay: 550 });

    if (this.reviveAvailable) {
      revBtn.on('pointerover', () => revBtn.setFillStyle(0xFFCA28));
      revBtn.on('pointerout',  () => revBtn.setFillStyle(0xF9A825));
      revBtn.on('pointerdown', () => {
        revBtn.disableInteractive().setFillStyle(0xBDBDBD);
        revBtnTxt.setText(tx.reviveWatching).setColor('#888');

        const doRevive = (rewarded) => {
          if (rewarded) {
            this.game.events.emit('reviveGame');
          } else {
            revBtnTxt.setText(tx.reviveNotAvail).setColor('#888');
          }
        };

        if (typeof sdk !== 'undefined' && sdk.showRewarded) {
          sdk.showRewarded(doRevive);
        } else {
          // SDK 未対応環境（GitHub Pages 等）: 3秒後に復活
          this.time.delayedCall(3000, () => doRevive(true));
        }
      });
    }

    // ── リトライボタン（ピンク）
    const btn = this.add.rectangle(240, 460, 210, 48, 0xFF8FB8, 1)
      .setStrokeStyle(2, 0xFF6B9D).setInteractive({ cursor: 'pointer' }).setDepth(2).setAlpha(0);
    const btnTxt = this.add.text(240, 460, tx.playAgain, {
      fontSize: '18px', fontFamily: 'Arial',
      color: '#fff', stroke: '#C0006A', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 300, delay: 650 });

    btn.on('pointerover', () => btn.setFillStyle(0xFFB3CE));
    btn.on('pointerout',  () => btn.setFillStyle(0xFF8FB8));
    btn.on('pointerdown', () => {
      btn.disableInteractive();
      this.tweens.add({
        targets: [panel, title, rankTxt, scoreLabel, bestTxt, btn, btnTxt, revBtn, revBtnTxt],
        alpha: 0, duration: 200,
        onComplete: () => {
          // Phaser のシーンライフサイクル競合を完全に回避するため
          // ページリロードで確実に再スタートする。
          // ベストスコアは localStorage に保存済みなので消えない。
          window.location.reload();
        }
      });
    });

    // シェアボタン
    const shareBtn = this.add.text(240, 514, tx.share, {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#1976D2', stroke: '#fff', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(2).setAlpha(0).setInteractive({ cursor: 'pointer' });
    this.tweens.add({ targets: shareBtn, alpha: 1, duration: 300, delay: 700 });
    shareBtn.on('pointerdown', () => {
      const shareText = `🍓 Fruit Bubble Pop\n${tx.score}: ${this.finalScore.toLocaleString()} pt!`;
      const showCopied = () => {
        const orig = shareBtn.text;
        shareBtn.setText('✅ Copied!');
        this.time.delayedCall(2000, () => {
          if (shareBtn && shareBtn.scene) shareBtn.setText(orig);
        });
      };
      const legacyCopy = () => {
        try {
          const ta = document.createElement('textarea');
          ta.value = shareText;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (ok) showCopied();
          else openTwitter();
        } catch (e) { openTwitter(); }
      };
      const openTwitter = () => {
        // 最終フォールバック: Twitter(X) の投稿画面を新規タブで開く
        const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);
        window.open(url, '_blank');
      };

      // 1) モバイル標準シェア
      if (navigator.share) {
        navigator.share({ title: 'Fruit Bubble Pop', text: shareText })
          .catch(() => legacyCopy());
        return;
      }
      // 2) Clipboard API (HTTPS 必須)
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareText)
          .then(showCopied)
          .catch(() => legacyCopy());
        return;
      }
      // 3) レガシー execCommand コピー
      legacyCopy();
    });
  }
}
