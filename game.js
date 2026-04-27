// フルーツバブル — メインエントリ

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#FFF5F9',
  scene: [GameScene, UIScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
};

const game = new Phaser.Game(config);
window._gdGame = game; // GD SDK の広告イベントからアクセスするための参照
