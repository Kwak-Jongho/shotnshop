// functions/analyze.js (Cloudflare Pages Functions 형식)

export async function onRequestPost(context) {
  // context.request 에는 클라이언트(앱)가 보낸 데이터가 들어있고,
  // context.env 에는 Cloudflare 대시보드에서 설정할 환경변수(API KEY)가 들어있습니다.
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { mode, image, query, system } = await request.json();

    let messages;
    if (mode === 'image' && image) {
      messages = [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: '이 상품 이미지를 분석하고 JSON으로만 응답해주세요.' }
        ]
      }];
    } else {
      messages = [{
        role: 'user',
        content: `"${query}" 상품을 분석하고 JSON으로만 응답해주세요.`
      }];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        system: system,
        messages: messages,
      })
    });

    const data = await response.json();
    const raw = data.content?.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}