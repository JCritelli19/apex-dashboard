export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { messages, systemPrompt, imageBase64, imageType, mode } = req.body;

  try {
    let requestBody;

    if (mode === 'food_analysis' && imageBase64) {
      // Food photo analysis mode
      requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a nutrition expert AI. When given a food photo, analyze it and return ONLY a valid JSON object with no extra text, markdown, or explanation. The JSON must have exactly these fields:
{
  "name": "descriptive food name",
  "meal": "Breakfast|Lunch|Dinner|Snack",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "confidence": "high|medium|low",
  "notes": "brief note about the estimate accuracy or any assumptions made"
}
Be realistic with estimates. If you can't identify the food clearly, use your best guess and set confidence to low.`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Analyze this food photo and return the nutrition estimate as JSON.',
              },
            ],
          },
        ],
      };
    } else {
      // Regular chat mode
      requestBody = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt || 'You are APEX, a personal AI assistant. Be concise and helpful.',
        messages: messages || [],
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (mode === 'food_analysis') {
      // Parse JSON from food analysis
      try {
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json({ food: parsed });
      } catch(e) {
        return res.status(200).json({ error: 'Could not parse food data', raw: text });
      }
    }

    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
