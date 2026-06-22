export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxq-BInGx55b5zs0EIqFMEfnlON4NmnS1TxuKhko8-b4wXgBoI4kl-95UoEXuE0Jp8Igg/exec';
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    
    const text = await response.text();
    res.status(200).json({ ok: true, result: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
