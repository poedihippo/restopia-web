import fs from 'fs'

export default function handler(req: any, res: any) {
  if (req.method === 'POST') {
    fs.writeFileSync('dump.json', JSON.stringify(req.body, null, 2))
    res.status(200).json({ ok: true })
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
