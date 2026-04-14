// autenticação de rotas usando JSON Web Tokens (JWT)
const jwt = require('jsonwebtoken');

// Middleware de autenticação para proteger rotas, verificando o token JWT enviado no cabeçalho Authorization
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido. Faça login.' });
  }

  try {
    const payload  = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario    = payload;
    next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}


// EXPORTANDO O MIDDLEWARE DE AUTENTICAÇÃO PARA USO NAS ROTAS PROTEGIDAS
module.exports = autenticar;
