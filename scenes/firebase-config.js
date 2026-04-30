// ============================================================
//  Firebase 設定
//  firebase.google.com でプロジェクトを作成し、
//  Realtime Database を有効化した後、下記の値を書き換えてください。
// ============================================================

window.FB_CONFIG = {
  apiKey:            'AIzaSyAQHcWCr1yA1bt8C5qUBf8b2x5ZHiQzFSY',
  authDomain:        'fruit-bubble-759e6.firebaseapp.com',
  databaseURL:       'https://fruit-bubble-759e6-default-rtdb.firebaseio.com',
  projectId:         'fruit-bubble-759e6',
  storageBucket:     'fruit-bubble-759e6.firebasestorage.app',
  messagingSenderId: '178783438442',
  appId:             '1:178783438442:web:50075df3eea89a1fe56c13',
};

// ── Firebase 初期化 ──────────────────────────────────────────
// FB_CONFIG.databaseURL が設定済みなら初期化を試みる
window.FB_READY = false;
(function () {
  if (!window.FB_CONFIG || window.FB_CONFIG.databaseURL.includes('YOUR_PROJECT')) {
    console.warn('[Ranking] Firebase 未設定。ランキング機能は無効です。');
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FB_CONFIG);
    }
    window.FB_DB    = firebase.database();
    window.FB_READY = true;
    console.log('[Ranking] Firebase 接続OK');
  } catch (e) {
    console.error('[Ranking] Firebase 初期化失敗', e);
  }
})();

// ── ランキング API ───────────────────────────────────────────
window.RankingAPI = {

  // 期間キーを返す
  _key(period) {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const d   = String(now.getDate()).padStart(2, '0');
    if (period === 'daily')   return `${y}-${m}-${d}`;
    if (period === 'monthly') return `${y}-${m}`;
    // weekly: ISO week number
    const jan4  = new Date(y, 0, 4);
    const week  = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  },

  // スコアを送信（Top10 に入れるなら push）
  async submit(period, name, score) {
    if (!window.FB_READY) return false;
    const key  = this._key(period);
    const ref  = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);

    // 現在の Top10 を確認
    const snap   = await ref.orderByChild('score').limitToLast(10).once('value');
    const entries = [];
    snap.forEach(c => entries.push({ key: c.key, ...c.val() }));

    // Top10 未満 or 最下位より高ければ push
    const minScore = entries.length < 10 ? -1 : Math.min(...entries.map(e => e.score));
    if (score <= minScore) return false;

    // push
    await ref.push({ name: name.slice(0, 8), score, ts: Date.now() });

    // 11件以上になったら最小スコアのエントリを削除
    if (entries.length >= 10) {
      const worst = entries.reduce((a, b) => a.score < b.score ? a : b);
      await ref.child(worst.key).remove();
    }
    return true;
  },

  // Top10 取得 → [{rank, name, score, ts, isYou}] を返す
  async fetch(period, myScore) {
    if (!window.FB_READY) return null;
    const key  = this._key(period);
    const ref  = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
    const snap = await ref.orderByChild('score').limitToLast(10).once('value');
    const rows = [];
    snap.forEach(c => rows.push(c.val()));
    rows.sort((a, b) => b.score - a.score);

    let marked = false;  // 自分は1つだけハイライト
    return rows.map((r, i) => {
      const isYou = !marked && myScore != null && r.score === myScore;
      if (isYou) marked = true;
      return { rank: i + 1, name: r.name, score: r.score, ts: r.ts, isYou };
    });
  },

  // スコアが Top10 圏内かチェック
  async isInTop10(period, score) {
    if (!window.FB_READY) return false;
    const key  = this._key(period);
    const ref  = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
    const snap = await ref.orderByChild('score').limitToLast(10).once('value');
    const entries = [];
    snap.forEach(c => entries.push(c.val().score));
    if (entries.length < 10) return true;
    return score > Math.min(...entries);
  },

  // ランキング内の旧名を新名に一括更新（設定での名前変更時に呼ぶ）
  async renamePlayer(oldName, newName) {
    if (!window.FB_READY || !oldName || !newName || oldName === newName) return;
    const periods = ['daily', 'weekly', 'monthly'];
    const updates = [];
    for (const period of periods) {
      const key = this._key(period);
      const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
      const snap = await ref.once('value');
      snap.forEach(child => {
        if (child.val().name === oldName) {
          updates.push(ref.child(child.key).update({ name: newName.slice(0, 8) }));
        }
      });
    }
    await Promise.all(updates);
  },
};
