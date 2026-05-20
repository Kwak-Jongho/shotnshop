// functions/api/purchases.js
// GET  /api/purchases?user_id=xxx  → 구매 이력 목록
// POST /api/purchases               → 구매 이력 저장

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'GET') {
    const userId = new URL(request.url).searchParams.get('user_id');
    if (!userId) {
      return new Response(JSON.stringify([]), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC'
    ).bind(userId).all();
    return new Response(JSON.stringify(results), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    const { user_id, product_name, brand, category, emoji, best_price, best_site, best_url, repeat_days } = await request.json();
    if (!user_id || !product_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    const purchased_at = new Date().toISOString();
    let next_reminder = null;
    if (repeat_days) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(repeat_days));
      next_reminder = d.toISOString().split('T')[0];
    }
    await env.DB.prepare(
      'INSERT INTO purchases (id, user_id, product_name, brand, category, emoji, best_price, best_site, best_url, purchased_at, repeat_days, next_reminder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user_id, product_name, brand || '', category || '', emoji || '📦', best_price || 0, best_site || '', best_url || '', purchased_at, repeat_days || null, next_reminder).run();
    return new Response(JSON.stringify({ success: true, id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
}
