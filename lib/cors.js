const ALLOWED_PATTERNS = [
  /^https:\/\/[\w-]+\.github\.io$/,
  /^https:\/\/re-el-scribbler[\w-]*\.vercel\.app$/,
  /^https:\/\/re-el-scribbler\.vercel\.app$/,
  /^https:\/\/([\w-]+\.)?re-el\.co\.za$/,
  /^http:\/\/localhost:\d+$/
];

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_PATTERNS.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}
