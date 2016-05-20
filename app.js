var express = require('express');
var compress = require('compression');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var lusca = require('lusca');
var dotenv = require('dotenv');
var MongoStore = require('connect-mongo/es5')(session);
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var sass = require('node-sass-middleware');
var multer = require('multer');
var upload = multer({ dest: path.join(__dirname, 'uploads') });

//Controllers
var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var apiController = require('./controllers/api');
var contactController = require('./controllers/contact');
var petsController = require('./controllers/pets');

dotenv.load({ path: 'var.env' });

var passportConfig = require('./config/passport');

var app = express();

mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI);

mongoose.connection.on('error', function() {
  console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
  process.exit(1);
});

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(sass({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  sourceMap: true
}));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB || process.env.MONGOLAB_URI,
    autoReconnect: true
  })
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(function(req, res, next) {
  if (req.path === '/api/upload') {
    next();
  } else {
    //lusca.csrf()(req, res, next); TODO
    next();
  }
});

app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(false));
app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});
app.use(function(req, res, next) {
  // After successful login, redirect back to /api, /contact or /
  if (/(api)|(contact)|(^\/$)/i.test(req.path)) {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));

app.all('*',function(req,res,next){
    if(userController.isAuthenticated){
        next();
    }else{
        next(new Error(401)); // 401 Not Authorized
    }
});

app.get('/', homeController.index);

app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);

app.get('/logout', userController.logout);

app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);

app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);

app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);

app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);

app.get('/account',  userController.getAccount);
app.post('/account/profile', userController.postUpdateProfile);
app.post('/account/password', userController.postUpdatePassword);
app.post('/account/delete',  userController.postDeleteAccount);
app.get('/account/unlink/:provider', userController.getOauthUnlink);

app.get('/api', apiController.getApi);
app.get('/api/facebook',  passportConfig.isAuthorized, apiController.getFacebook);
app.get('/api/upload', apiController.getFileUpload);
app.post('/api/upload', upload.single('myFile'), apiController.postFileUpload);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});

app.get('/pet/list', petsController.listPets);
app.post('/pet', petsController.newPet);
app.get('/pet/:id',  petsController.getPet);
app.put('/pet/:id', petsController.editPet);
app.delete('/pet/:id', petsController.deletePet);

app.use(errorHandler());

app.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
