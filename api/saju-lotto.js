module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { birthDate, birthTime, gender } = req.body || {};

  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    res.status(400).json({ error: '생년월일(YYYY-MM-DD)을 올바르게 입력해주세요.' });
    return;
  }

  const genderLabel = gender === 'male' ? '남성' : gender === 'female' ? '여성' : '미상';
  const timeLabel = birthTime && /^\d{2}:\d{2}$/.test(birthTime) ? birthTime : '모름';

  const systemPrompt = [
    '너는 사주(四柱, 명리학) 원리를 참고해 로또 번호를 추천해주는 재미용 챗봇이다.',
    '생년월일, 태어난 시간, 성별을 바탕으로 오행(五行)과 사주 기운을 가볍게 해석한 뒤,',
    '1~45 범위에서 서로 다른 본번호 6개와, 본번호와 겹치지 않는 보너스 번호 1개를 추천한다.',
    '반드시 아래 JSON 형식으로만 응답하고 다른 텍스트를 덧붙이지 않는다.',
    '{"main":[n1,n2,n3,n4,n5,n6],"bonus":n7,"message":"사주 해석과 번호 추천 이유를 담은 한국어 설명 3~4문장"}',
    'main은 오름차순 정렬 여부와 무관하게 1~45 사이의 서로 다른 정수 6개, bonus는 main에 포함되지 않는 1~45 사이의 정수 1개여야 한다.',
    '이 추천은 오락 목적이며 실제 당첨을 보장하지 않는다는 점을 message에 자연스럽게 암시해도 좋다.'
  ].join('\n');

  const userPrompt = `생년월일: ${birthDate}\n태어난 시간: ${timeLabel}\n성별: ${genderLabel}`;

  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        temperature: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!completion.ok) {
      const errBody = await completion.text();
      res.status(502).json({ error: `OpenAI API 오류 (${completion.status}): ${errBody}` });
      return;
    }

    const data = await completion.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      res.status(502).json({ error: 'AI 응답을 해석하지 못했습니다. 다시 시도해주세요.' });
      return;
    }

    const main = Array.isArray(parsed.main) ? parsed.main.map(Number) : [];
    const bonus = Number(parsed.bonus);
    const isValid =
      main.length === 6 &&
      new Set(main).size === 6 &&
      main.every((n) => Number.isInteger(n) && n >= 1 && n <= 45) &&
      Number.isInteger(bonus) &&
      bonus >= 1 &&
      bonus <= 45 &&
      !main.includes(bonus);

    if (!isValid) {
      res.status(502).json({ error: 'AI가 유효하지 않은 번호를 반환했습니다. 다시 시도해주세요.' });
      return;
    }

    res.status(200).json({
      main: [...main].sort((a, b) => a - b),
      bonus,
      message: typeof parsed.message === 'string' ? parsed.message : ''
    });
  } catch (err) {
    res.status(500).json({ error: `서버 오류: ${err.message}` });
  }
};
