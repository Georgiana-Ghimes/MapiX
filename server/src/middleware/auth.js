import jwt from 'jsonwebtoken';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Autentificare necesară.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Sesiunea a expirat. Conectează-te din nou.' });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };
    } catch {
      // ignore
    }
  }
  next();
}

export function adminRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Autentificare necesară.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Doar administratorii pot face această acțiune.' });
  }
  next();
}
