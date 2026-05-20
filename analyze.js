// functions/analyze.js
// Cloudflare Pages Functions 전용 백엔드 코드 (최신 Haiku 4.5 모델 적용)

export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY; 

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await request.json();
    const { mode, image, query, system } = body;

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
        // 💡 핵심 수정: 서비스가 종료된 모델 대신 최신 Claude Haiku 4.5 모델을 사용합니다.
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: system,
        messages: messages,
      })
    });

    const data = await response.json();
    
    // API 호출 자체에서 에러가 발생했을 경우의 예외 처리
    if (data.error) {
      throw new Error(data.error.message || 'Anthropic API 연동 에러');
    }

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