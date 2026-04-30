// ============================================================
//  Firebase 設定
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
    const jan4 = new Date(y, 0, 4);
    const week = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
  },

  // 全エントリをスコア降順で返す（インデックス不要）
  async _fetchAll(ref) {
    const snap = await ref.once('value');
    const all  = [];
    snap.forEach(c => all.push({ key: c.key, ...c.val() }));
    all.sort((a, b) => b.score - a.score);
    return all;
  },

  // スコアを送信（1人最大3エントリまで、Top10チェックあり）
  // ref.update() でアトミックに削除＋追加するため競合なし
  // 戻り値: { ok: bool, reason?: 'limitReached'|'outOfTop10', myBest?: number }
  async submit(period, name, score) {
    if (!window.FB_READY) return { ok: false };
    const key = this._key(period);
    const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
    const MAX_PER_PLAYER = 3;
    const MAX_TOTAL      = 10;

    // 全エントリ取得（スコア降順）
    const all       = await this._fetchAll(ref);
    const myEntries = all.filter(e => e.name === name);

    // 自分のエントリが上限以上か確認
    if (myEntries.length >= MAX_PER_PLAYER) {
      const myBest  = myEntries[0].score;
      const myWorst = myEntries[myEntries.length - 1].score;
      if (score <= myWorst) {
        return { ok: false, reason: 'limitReached', myBest };
      }
    }

    // Top10 圏内かチェック
    const top10min = all.length < MAX_TOTAL ? -1 : all[MAX_TOTAL - 1].score;
    if (score <= top10min) return { ok: false, reason: 'outOfTop10' };

    // ── アトミック更新オブジェクトを構築 ──────────────────────
    const updates = {};

    // 自分が上限超えなら低スコアから削除して MAX_PER_PLAYER-1 個にする
    if (myEntries.length >= MAX_PER_PLAYER) {
      const excessCount = myEntries.length - (MAX_PER_PLAYER - 1);
      const toRemove    = myEntries.slice(myEntries.length - excessCount);
      for (const entry of toRemove) {
        updates[entry.key] = null; // null = 削除
      }
    }

    // 全体 Top10 超えなら全体最低スコアを削除
    // (削除予定エントリを除いた残りで判定)
    const deletedKeys = Object.keys(updates);
    const remaining   = all.filter(e => !deletedKeys.includes(e.key));
    if (remaining.length >= MAX_TOTAL) {
      const worst = remaining[remaining.length - 1];
      updates[worst.key] = null;
    }

    // 新エントリを追加（push().key で安全なキー生成）
    const newKey       = ref.push().key;
    updates[newKey]    = { name: name.slice(0, 8), score, ts: Date.now() };

    // 一括アトミック更新
    await ref.update(updates);
    return { ok: true };
  },

  // Top10 取得 → [{rank, name, score, ts, isYou}] を返す
  async fetch(period, myScore) {
    if (!window.FB_READY) return null;
    const key   = this._key(period);
    const ref   = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
    const all   = await this._fetchAll(ref);
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

  // ランキング内の旧名を新名に一括更新
  async renamePlayer(oldName, newName) {
    if (!window.FB_READY || !oldName || !newName || oldName === newName) return;
    const periods = ['daily', 'weekly', 'monthly'];
    const promises = [];
    for (const period of periods) {
      const key = this._key(period);
      const ref = window.FB_DB.ref(`fruit-bubble/${period}/${key}`);
      const snap = await ref.once('value');
      snap.forEach(child => {
        if (child.val().name === oldName) {
          promises.push(ref.child(child.key).update({ name: newName.slice(0, 8) }));
        }
      });
    }
    await Promise.all(promises);
  },
};
