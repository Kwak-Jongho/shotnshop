// functions/api/purchases/[id].js
// DELETE /api/purchases/:id → 구매 이력 삭제

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM purchases WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
}
