const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();

// --- Sessions (pour protéger admin) ---
app.use(session({
  secret: 'mot-de-passe-secret',
  resave: false,
  saveUninitialized: true
}));

// --- Middlewares ---
app.use(express.urlencoded({ extended: true }));

// Servir "public" (chemin absolu) UNE SEULE FOIS
app.use(express.static(path.join(__dirname, 'public')));

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.redirect('/login');
}

// --- Page login ---
app.get('/login', (req, res) => {
  res.send(`
    <h2>Connexion</h2>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Mot de passe" required />
      <button type="submit">Se connecter</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'chancel123') {
    req.session.loggedIn = true;
    return res.redirect('/admin.html');
  }
  return res.send('Mot de passe incorrect. <a href="/login">Réessayer</a>');
});

// --- Page admin protégée ---
app.get('/admin.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- Multer (upload) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'images'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Upload sécurisé + redirection vers /
app.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('Aucun fichier sélectionné.');
  console.log('✅ Image enregistrée :', req.file.filename);
  console.log('📁 Chemin complet  :', req.file.path);
  return res.redirect('/'); // revient sur le portfolio
});

// --- API JSON : liste des images pour le script de index.html ---
app.get('/images-list', (req, res) => {
  const imagesPath = path.join(__dirname, 'public', 'images');
  fs.readdir(imagesPath, (err, files = []) => {
    if (err) {
      console.error('❌ Erreur lecture /public/images :', err);
      return res.json([]);
    }
    const list = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
    return res.json(list);
  });
});

// --- Page d’accueil : servir TON index.html ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Supprimer une image (protégé par login)
app.post('/delete', authMiddleware, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).send('Nom de fichier manquant.');

    // Empêche toute sortie de dossier (sécurité)
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
      return res.redirect('/'); // Retour à l’accueil après suppression
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send('Erreur serveur.');
  }
});



// --- Lancement serveur ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur en ligne : http://localhost:${PORT}`);
});
