// functions/analyze.js
// Cloudflare Pages Functions 백엔드
// Claude: 상품 인식 + AI 분석 / 네이버 쇼핑 API: 실제 가격 + 상품 링크

export async function onRequestPost(context) {
  const { request, env } = context;
  const API_KEY = env.ANTHROPIC_API_KEY;
  const NAVER_ID = env.NAVER_CLIENT_ID;
  const NAVER_SECRET = env.NAVER_CLIENT_SECRET;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { mode, image, query, system } = body;

    // Step 1: Claude - 상품 인식 + AI 분석 (가격 제외)
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

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system,
        messages,
      })
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(claudeData.error.message);

    const raw = claudeData.content?.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Step 2: 네이버 쇼핑 API - 실제 가격 + 실제 상품 링크
    if (NAVER_ID && NAVER_SECRET) {
      // 텍스트 검색: 사용자가 직접 입력한 쿼리 우선 사용 (브랜드명 포함)
      // 이미지 검색: Claude가 인식한 브랜드+상품명 조합
      const claudeName = parsed.recognized || parsed.product_list?.[0]?.name || '';
      const claudeBrand = parsed.product_list?.[0]?.brand || parsed.selected?.brand || '';
      let naverQuery;
      if (query) {
        // 텍스트 입력: 원본 쿼리 그대로 사용
        naverQuery = query;
      } else {
        // 이미지 입력: 브랜드 + 상품명 조합
        naverQuery = claudeBrand && !claudeName.includes(claudeBrand)
          ? `${claudeBrand} ${claudeName}`
          : claudeName;
      }
      const naverSites = await searchNaver(NAVER_ID, NAVER_SECRET, naverQuery);

      if (naverSites.length > 0 && parsed.selected) {
        parsed.selected.sites = naverSites;
        parsed.selected.best_price = naverSites[0].price;
        parsed.selected.price_max = naverSites[naverSites.length - 1].price;
      }
    }

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

async function searchNaver(clientId, clientSecret, query) {
  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=100&sort=asc`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      }
    });
    if (!res.ok) return [];
    const data = await res.json();

    // 쇼핑몰별 최저가 1개씩 추출
    const mallMap = {};
    for (const item of (data.items || [])) {
      const price = parseInt(item.lprice) || 0;
      if (price === 0) continue;
      const mall = item.mallName;
      if (!mallMap[mall] || price < mallMap[mall].price) {
        mallMap[mall] = {
          site: mall,
          price,
          original: parseInt(item.hprice) || 0,
          url: item.link,
        };
      }
    }

    // 가격순 정렬 후 상위 10개
    return Object.values(mallMap)
      .sort((a, b) => a.price - b.price)
      .slice(0, 10)
      .map((item, i) => {
        const hasDisc = item.original > item.price;
        return {
          rank: i + 1,
          site: item.site,
          emoji: getMallEmoji(item.site),
          price: item.price,
          original: hasDisc ? item.original : item.price,
          disc: hasDisc ? Math.round((1 - item.price / item.original) * 100) : 0,
          tags: getMallTags(item.site),
          url: item.url,
        };
      });
  } catch (e) {
    console.error('Naver API error:', e);
    return [];
  }
}

function getMallEmoji(name) {
  if (name.includes('쿠팡')) return '🛒';
  if (name.includes('네이버') || name.includes('스마트스토어')) return '🟢';
  if (name.includes('11번가')) return '1️⃣';
  if (name.includes('G마켓') || name.includes('Gmarket')) return '🛍️';
  if (name.includes('옥션') || name.includes('Auction')) return '🔨';
  if (name.includes('SSG') || name.includes('신세계')) return '🏬';
  if (name.includes('롯데')) return '🧡';
  if (name.includes('위메프')) return '💜';
  if (name.includes('티몬')) return '🐾';
  if (name.includes('인터파크')) return '🎡';
  if (name.includes('카카오')) return '💛';
  if (name.includes('무신사')) return '👟';
  return '🏪';
}

function getMallTags(name) {
  if (name.includes('쿠팡')) return ['로켓배송'];
  if (name.includes('네이버') || name.includes('스마트스토어')) return ['네이버페이'];
  if (name.includes('11번가')) return ['무료배송'];
  if (name.includes('G마켓')) return ['스마일배송'];
  if (name.includes('옥션')) return ['OK캐시백'];
  if (name.includes('SSG') || name.includes('신세계')) return ['새벽배송'];
  if (name.includes('롯데')) return ['엘포인트'];
  if (name.includes('인터파크')) return ['포인트적립'];
  return [];
}
