'use strict';

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

app.get('/api/fetch-makerworld', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  const match = url.match(/makerworld\.com\/[a-z-]+\/models\/(\d+)/);
  if (!match) {
    return res.status(400).json({
      error: 'Could not parse model ID — expected: https://makerworld.com/en/models/123456',
    });
  }

  const modelId = match[1];
  const apiUrl = `https://makerworld.com/api/v1/design-service/design/${modelId}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://makerworld.com/',
        'Origin': 'https://makerworld.com',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return res.status(502).json({
        error: `MakerWorld API returned HTTP ${response.status}`,
        detail: body.slice(0, 300),
      });
    }

    const data = await response.json();

    const tags = (data.tags || [])
      .map((t) => (typeof t === 'string' ? t : t.name || t.tag || t.tagName || ''))
      .filter(Boolean);

    return res.json({
      title:       data.title || '',
      description: stripHtml(data.description || ''),
      creator:     data.designCreator?.name || data.makerName || '',
      license:     data.license?.name || data.licenseName || '',
      tags,
      sourceUrl:   url,
      modelId,
    });
  } catch (err) {
    return res.status(500).json({ error: `Fetch failed: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`MakerWorld → Toybox server running at http://localhost:${PORT}`);
});
