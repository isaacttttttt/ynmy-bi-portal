export async function searchHistory(db, user, category) {
  const { rows: items } = await db.query('SELECT query_text AS query, searched_at AS "searchedAt" FROM portal_search_history WHERE user_code = $1 AND category = $2 ORDER BY searched_at DESC, query_key LIMIT 20', [user, category]);
  return { items: items.map(item => ({ ...item, searchedAt: item.searchedAt.toISOString() })) };
}
export async function saveSearch(db, user, category, query) {
  const key = query.toLocaleLowerCase();
  await db.query(`INSERT INTO portal_search_history (user_code, category, query_key, query_text, searched_at)
    VALUES ($1, $2, $3, $4, clock_timestamp()) ON CONFLICT (user_code, category, query_key)
    DO UPDATE SET query_text = EXCLUDED.query_text, searched_at = EXCLUDED.searched_at`, [user, category, key, query]);
  await db.query(`DELETE FROM portal_search_history WHERE user_code = $1 AND category = $2 AND query_key IN
    (SELECT query_key FROM portal_search_history WHERE user_code = $1 AND category = $2 ORDER BY searched_at DESC, query_key OFFSET 20)`, [user, category]);
  return searchHistory(db, user, category);
}
