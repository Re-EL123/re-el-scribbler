export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ success: true });
  }
  if (req.method === 'PATCH') {
    return res.status(200).json({ success: true });
  }
  if (req.method === 'DELETE') {
    return res.status(200).json({ success: true });
  }
  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  res.status(405).end('Method Not Allowed');
}
