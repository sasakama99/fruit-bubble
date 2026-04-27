// ============================================================
//  BadgeSystem — 実績バッジ定義 & 管理  v1
// ============================================================

window.BADGE_DEFS = [
  // ── スコア達成（7種）
  { id:'score_100',    type:'score', emoji:'🌱', threshold:100,
    name:{ ja:'100点達成！',       en:'100 Points!' },
    desc:{ ja:'はじめての100点',   en:'Score 100 pts' } },
  { id:'score_1k',     type:'score', emoji:'🍇', threshold:1000,
    name:{ ja:'1,000点突破！',     en:'1K Points!' },
    desc:{ ja:'スコア1,000点',     en:'Score 1,000 pts' } },
  { id:'score_5k',     type:'score', emoji:'🍊', threshold:5000,
    name:{ ja:'5,000点突破！',     en:'5K Points!' },
    desc:{ ja:'スコア5,000点',     en:'Score 5,000 pts' } },
  { id:'score_10k',    type:'score', emoji:'🍎', threshold:10000,
    name:{ ja:'1万点突破！',        en:'10K Points!' },
    desc:{ ja:'スコア10,000点',    en:'Score 10,000 pts' } },
  { id:'score_50k',    type:'score', emoji:'🍋', threshold:50000,
    name:{ ja:'5万点突破！',        en:'50K Points!' },
    desc:{ ja:'スコア50,000点',    en:'Score 50,000 pts' } },
  { id:'score_100k',   type:'score', emoji:'🍑', threshold:100000,
    name:{ ja:'10万点突破！',       en:'100K Points!' },
    desc:{ ja:'スコア100,000点',   en:'Score 100,000 pts' } },
  { id:'score_500k',   type:'score', emoji:'🍍', threshold:500000,
    name:{ ja:'50万点！伝説！',     en:'Legend 500K!' },
    desc:{ ja:'スコア500,000点',   en:'Score 500,000 pts' } },

  // ── コンボ（4種）
  { id:'combo_2',      type:'combo', emoji:'✨', threshold:2,
    name:{ ja:'コンボ達成！',       en:'First Combo!' },
    desc:{ ja:'2コンボ以上',       en:'2+ chain combo' } },
  { id:'combo_3',      type:'combo', emoji:'🔥', threshold:3,
    name:{ ja:'3コンボ！',          en:'3 Combo!' },
    desc:{ ja:'3コンボ以上',       en:'3+ chain combo' } },
  { id:'combo_5',      type:'combo', emoji:'💫', threshold:5,
    name:{ ja:'5コンボ！',          en:'5 Combo!' },
    desc:{ ja:'5コンボ以上',       en:'5+ chain combo' } },
  { id:'combo_10',     type:'combo', emoji:'🌟', threshold:10,
    name:{ ja:'10コンボ！神業！',   en:'10 Combo! God!' },
    desc:{ ja:'10コンボ以上',      en:'10+ chain combo' } },

  // ── フルーツ進化（4種）
  { id:'fruit_5',      type:'fruit', emoji:'🍑', level:5,
    name:{ ja:'もも誕生！',         en:'Peach Born!' },
    desc:{ ja:'ももを作った',      en:'Created a Peach' } },
  { id:'fruit_6',      type:'fruit', emoji:'🍍', level:6,
    name:{ ja:'パイナップル誕生！', en:'Pineapple Born!' },
    desc:{ ja:'パイナップルを作った',en:'Created a Pineapple' } },
  { id:'fruit_7',      type:'fruit', emoji:'🍉', level:7,
    name:{ ja:'スイカ誕生！',       en:'Watermelon Born!' },
    desc:{ ja:'スイカを作った',     en:'Created a Watermelon' } },
  { id:'fruit_8',      type:'fruit', emoji:'🌈', level:8,
    name:{ ja:'レインボー誕生！',   en:'Rainbow Born!' },
    desc:{ ja:'レインボーを作った', en:'Created a Rainbow!' } },

  // ── 特殊プレイ（6種）
  { id:'fever',        type:'event', emoji:'🎉',
    name:{ ja:'フィーバー！',       en:'Fever Time!' },
    desc:{ ja:'フィーバーを初発動', en:'Activate Fever for 1st time' } },
  { id:'fever_combo',  type:'event', emoji:'💎',
    name:{ ja:'フィーバーコンボ！', en:'Fever Combo!' },
    desc:{ ja:'フィーバー中にコンボ',en:'Combo during Fever' } },
  { id:'multi_match',  type:'event', emoji:'⚡',
    name:{ ja:'縦横同時消し！',     en:'Cross Combo!' },
    desc:{ ja:'縦と横を同時に消した',en:'Clear row & column at once' } },
  { id:'danger_clear', type:'event', emoji:'🛡️',
    name:{ ja:'崖っぷち回避！',     en:'Danger Clear!' },
    desc:{ ja:'危険ライン超えを消去で回避',en:'Clear fruit above danger line' } },
  { id:'match_5',      type:'event', emoji:'🎯',
    name:{ ja:'一撃5個消し！',      en:'Big Clear x5!' },
    desc:{ ja:'1度に5個以上消した', en:'Clear 5+ fruits at once' } },
  { id:'new_best',     type:'event', emoji:'🏆',
    name:{ ja:'ベスト更新！',       en:'New Record!' },
    desc:{ ja:'ベストスコアを更新', en:'Beat your best score' } },

  // ── プレイ回数（3種）
  { id:'play_1',       type:'play', emoji:'🎮', threshold:1,
    name:{ ja:'はじめてのプレイ',   en:'First Play!' },
    desc:{ ja:'初回プレイ',        en:'Play for the first time' } },
  { id:'play_10',      type:'play', emoji:'🌸', threshold:10,
    name:{ ja:'10回プレイ！',       en:'10 Plays!' },
    desc:{ ja:'10回プレイした',    en:'Played 10 times' } },
  { id:'play_50',      type:'play', emoji:'🌺', threshold:50,
    name:{ ja:'50回プレイ！',       en:'50 Plays!' },
    desc:{ ja:'50回プレイした',    en:'Played 50 times' } },

  // ── 特別記録（1種）
  { id:'no_fever_5k',  type:'event', emoji:'💪',
    name:{ ja:'ストイック！',       en:'Stoic!' },
    desc:{ ja:'フィーバーなしで5000点',en:'5K pts without Fever' } },
];

// ============================================================
//  BadgeManager — シングルトン
// ============================================================
window.BadgeManager = {
  _unlocked: null,

  get unlocked() {
    if (!this._unlocked) {
      try {
        this._unlocked = JSON.parse(
          localStorage.getItem('fruitBubbleBadges') || '[]'
        );
      } catch (e) { this._unlocked = []; }
    }
    return this._unlocked;
  },

  isUnlocked(id) { return this.unlocked.includes(id); },

  // 新規解除 → バッジ定義を返す（既解除なら null）
  unlock(id) {
    if (this.isUnlocked(id)) return null;
    this.unlocked.push(id);
    localStorage.setItem('fruitBubbleBadges', JSON.stringify(this.unlocked));
    return window.BADGE_DEFS.find(d => d.id === id) || null;
  },

  checkScore(score) {
    return window.BADGE_DEFS
      .filter(d => d.type === 'score' && score >= d.threshold)
      .map(d => this.unlock(d.id)).filter(Boolean);
  },

  checkCombo(combo) {
    return window.BADGE_DEFS
      .filter(d => d.type === 'combo' && combo >= d.threshold)
      .map(d => this.unlock(d.id)).filter(Boolean);
  },

  checkFruit(level) {
    return window.BADGE_DEFS
      .filter(d => d.type === 'fruit' && level >= d.level)
      .map(d => this.unlock(d.id)).filter(Boolean);
  },

  checkEvent(id) {
    const def = this.unlock(id);
    return def ? [def] : [];
  },

  // ゲーム開始時にプレイ回数インクリメント
  checkPlay() {
    const cnt = (parseInt(localStorage.getItem('fruitBubblePlayCount') || '0') || 0) + 1;
    localStorage.setItem('fruitBubblePlayCount', String(cnt));
    return window.BADGE_DEFS
      .filter(d => d.type === 'play' && cnt >= d.threshold)
      .map(d => this.unlock(d.id)).filter(Boolean);
  },

  getAll()      { return window.BADGE_DEFS.map(d => ({ ...d, earned: this.isUnlocked(d.id) })); },
  earnedCount() { return this.unlocked.filter(id => window.BADGE_DEFS.some(d => d.id === id)).length; },
  totalCount()  { return window.BADGE_DEFS.length; },
};
