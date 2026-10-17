export default async function handler(req, res) {
  if (req.method === 'POST') {
    return res.status(200).json({ success: true, message: 'Assistant endpoint ready' });
  }
  res.setHeader('Allow', ['POST']);
  res.status(405).end('Method Not Allowed');
}
