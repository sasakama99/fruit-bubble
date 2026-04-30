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

  // 全エントリを取得してスコア降順で返す（インデックス不要）
  async _fetchAll(ref) {
    const snap = await ref.once('value');
    const all  = [];
    snap.forEach(c => all.push({ key: c.key, ...c.val() }));
    all.sort((a, b) => b.score - a.score);
    return all;
  },

  // スコアを送信（1人最大3エントリまで、Top10チェックあり）
  // 戻り値: { ok: bool, reason?: 'limitReached'|'outOfTop10', myBest?: number }
  async submit(period, name, score) {
    if (!window.FB_READY) return { ok: false };
    const key = this._key(period);
    const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
    const MAX_PER_PLAYER = 3;

    // 全エントリ取得（クライアント側でソート済み）
    const all = await this._fetchAll(ref);

    // 自分のエントリを抽出
    const myEntries = all.filter(e => e.name === name);

    if (myEntries.length >= MAX_PER_PLAYER) {
      // 上限到達 → 自分の最低スコアを超えないと登録不可
      const myBest  = myEntries[0].score; // sorted desc なので先頭が最高
      const myWorst = myEntries[myEntries.length - 1]; // 末尾が最低
      if (score <= myWorst.score) {
        return { ok: false, reason: 'limitReached', myBest };
      }
      // 自分の最低エントリを削除（MAX_PER_PLAYER-1 個になるまで）
      const excessCount = myEntries.length - (MAX_PER_PLAYER - 1);
      const toRemove = myEntries.slice(myEntries.length - excessCount); // 末尾（低スコア）から
      for (const entry of toRemove) {
        await ref.child(entry.key).remove();
        const idx = all.findIndex(e => e.key === entry.key);
        if (idx !== -1) all.splice(idx, 1);
      }
    }

    // Top10 圏内かチェック（全エントリ中の順位で判定）
    const top10min = all.length < 10 ? -1 : all[9].score; // 10番目のスコア
    if (score <= top10min) return { ok: false, reason: 'outOfTop10' };

    // 登録
    await ref.push({ name: name.slice(0, 8), score, ts: Date.now() });

    // Top10 を超えていたら最低エントリを削除
    if (all.length >= 10) {
      const worst = all[all.length - 1];
      await ref.child(worst.key).remove();
    }
    return { ok: true };
  },

  // Top10 取得 → [{rank, name, score, ts, isYou}] を返す
  async fetch(period, myScore) {
    if (!window.FB_READY) return null;
    const key = this._key(period);
    const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);

    const all  = await this._fetchAll(ref);
    const top10 = all.slice(0, 10);

    let marked = false;
    return top10.map((r, i) => {
      const isYou = !marked && myScore != null && r.score === myScore;
      if (isYou) marked = true;
      return { rank: i + 1, name: r.name, score: r.score, ts: r.ts, isYou };
    });
  },

  // スコアが Top10 圏内かチェック
  async isInTop10(period, score) {
    if (!window.FB_READY) return false;
    const key = this._key(period);
    const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);

    const all = await this._fetchAll(ref);
    if (all.length < 10) return true;
    return score > all[9].score;
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
