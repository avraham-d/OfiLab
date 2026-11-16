/* ofiLab: one entry point for the 120 and 300 save-link codecs (OfiLabCompactV2).
   Loaded right after both codecs; formerly emitted by the build script. */
(function(root) {
  const unified = {
    MODEL_VERSION: 'v2',
    isLegacy50Token(token) {
      return Boolean(root.OfiLabCodec120?.isLegacy50Token?.(token));
    },
    encode(answers, cursor) {
      if (answers && answers.length === 50) {
        const err = Error('גרסת 50 (IPIP-50) יצאה משימוש. המערכת תומכת בשאלוני 120 ו-300 בלבד.');
        err.code = 'LEGACY_50_DEPRECATED';
        throw err;
      }
      const targetN = answers ? answers.length : 120;
      const safeCursor = Math.max(0, Math.min(targetN - 1, (Number.isInteger(cursor) && cursor >= 0 && cursor < targetN) ? cursor : 0));
      if (answers && answers.length === 300) return root.OfiLabCodec300.encode(answers, safeCursor);
      return root.OfiLabCodec120.encode(answers, safeCursor);
    },
    decode(token) {
      if (root.OfiLabCodec120?.isLegacy50Token?.(token)) {
        return root.OfiLabCodec120.decode(token);
      }
      const inv = root.document?.documentElement?.dataset?.inventory;
      const order = inv === 'ipip-neo-300'
        ? [root.OfiLabCodec300, root.OfiLabCodec120]
        : [root.OfiLabCodec120, root.OfiLabCodec300];
      let lastErr;
      for (const c of order) {
        if (!c) continue;
        try { return c.decode(token); } catch (e) { lastErr = e; }
      }
      throw lastErr || Error('Invalid save link');
    }
  };
  root.OfiLabCompactV2 = unified;
  root.OfiLabCompactSmall = root.OfiLabCodec120;
})(typeof window !== 'undefined' ? window : globalThis);
