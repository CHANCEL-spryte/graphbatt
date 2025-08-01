const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();

// Sessions (pour protéger admin)
app.use(session({
  secret: 'mot-de-passe-secret', // ⚠️ change en production (variable d'environnement)
  resave: false,
  saveUninitialized: true
}));

// Middlewares
app.use(express.urlencoded({ extended: true }));

// Servir "public" (chemin absolu)
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function authMiddleware(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.redirect('/login');
}

// Page de connexion
app.get('/login', (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Connexion</title></head>
    <body style="font-family:Segoe UI, Arial; padding:40px">
      <h2>Connexion</h2>
      <form method="POST" action="/login">
        <input type="password" name="password" placeholder="Mot de passe" required />
        <button type="submit">Se connecter</button>
      </form>
      <p><a href="/">← Retour au site</a></p>
    </body>
    </html>
  `);
});

// Traitement du login
app.post('/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'chancel123'; // change moi
  if (password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.redirect('/admin.html');
  }
  return res.send('Mot de passe incorrect. <a href="/login">Réessayer</a>');
});

// Page admin protégée
app.get('/admin.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Multer (upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'images')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Upload (protégé) + redirection vers l'accueil
app.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier sélectionné.');
  console.log('✅ Image enregistrée :', req.file.filename);
  return res.redirect('/');
});

// Suppression (protégé)
app.post('/delete', authMiddleware, (req, res) => {
  const { filename } = req.body || {};
  if (!filename) return res.status(400).send('Nom de fichier manquant.');
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Nom de fichier invalide.');
  }
  const filePath = path.join(__dirname, 'public', 'images', filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('❌ Erreur suppression :', err);
      return res.status(404).send('Fichier introuvable.');
    }
    console.log('🗑️ Image supprimée :', filename);
    return res.redirect('/');
  });
});

// API JSON : liste des images
app.get('/images-list', (req, res) => {
  const imagesPath = path.join(__dirname, 'public', 'images');
  fs.readdir(imagesPath, (err, files = []) => {
    if (err) {
      console.error('❌ Erreur lecture /public/images :', err);
      return res.json([]);
    }
    const list = files
      .map(f => f.trim())
      .filter(f => !f.startsWith('.'))
      .filter(f => /(\.(jpg|jpeg|png|gif|webp|svg|bmp|jfif|avif|heic))$/i.test(f));
    return res.json(list);
  });
});

// Accueil : sert TON index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne : http://localhost:${PORT}`));
