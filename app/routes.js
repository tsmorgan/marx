var express     = require('express'),
    _           = require('lodash'),
    fs          = require('fs'),
    router      = express.Router(),
    db_url      = process.env.MONGODB_URI || 'mongodb://localhost/marx',
    db          = require('monk')(db_url),
    tog         = require(__dirname + '/../lib/tog.js'),
    bk          = require(__dirname + '/bookmark.js');

var store = db.get('bookmarks');

var users = fs.readFileSync(__dirname + '/users.txt').toString().trim().split(/\s*\n/);
console.log(users);

/*
  Always check for the user cookie whatever page we're on
  If they don't have the it show the login screen instead.
*/
router.get("/*", function (req, res, next) {
  if (!req.cookies.marx_user)
  {
    console.log('checking cookies')
    res.render('login',{"cookie":req.cookies,users:users});
  } else {
    next();
  }
});

/*
  Home page
*/
router.get('/', function (req, res) {
  store.find({ tags:{ $in:['home'] } },{ sort:{ created: -1 }}).then(function(docs)
  {
    res.render('index',{"user":req.cookies.marx_user,"bookmarks":docs,"tags":['home']});
  });
});

/*
  Add a new bookmark form.
*/
router.get('/add/', function (req, res) {
    res.render('form',{"user":req.cookies.marx_user, "mark":req.query});
});

/*
  Details page for each bookmark (by ID)
*/
router.get('/view/:id', function (req, res) {
  store.findOne({"_id":req.params.id}).then(function(doc)
  {
    if (doc)
    {
      res.render('view',{"user":req.cookies.marx_user, "mark":doc});
    } else {
      res.send('Ooops! No bookmark found.');
    }
  });
});

/*
  Edit page for each bookmark (by ID), uses the
  same "form.html" template as the /add/ page.
*/
router.get('/edit/:id', function (req, res) {
  store.findOne({"_id":req.params.id}).then(function(doc)
  {
    if (doc)
    {
      var mark = doc;
      var h = _.findIndex(doc.humans, ['user', req.cookies.marx_user]);
      mark.me = doc.humans[h];
      res.render('form',{"user":req.cookies.marx_user, "mark":mark});
    } else {
      res.send('Ooops! No bookmark found.');
    }
  });
});

/*
  Delete URL will remove the bookmark (by ID) from the database.
*/
router.post('/delete/:id', function (req, res) {
  store.findOneAndDelete({"_id":req.params.id}).then(function(doc)
  {
    res.send(tog(doc));
  });
});

/*
  The route that the login form posts to. Just writes
  a cookie and passes you on to the home page.
*/
router.post('/api/login/', function (req, res) {
  // res.send(tog(req.body));
  var randomNumber=Math.random().toString();
  randomNumber=randomNumber.substring(2,randomNumber.length);
  res.cookie('marx_user',req.body.username, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
  res.redirect('/');
});

/*
  A route to log you out. It's what the username link
  at the top links to. Not really any reason for people
  to log out but it's there just in case.
*/
router.get('/api/logout/', function (req, res) {
  res.clearCookie('marx_user');
  res.redirect('/');
});

/*
  The route that /add/ and /edit/ post to. CHecks whether
  the bookmark is already in the database and then adds a
  new one if not or updates the existing one. See bookmark.js
  for some of the details.
*/
router.post('/api/marks/', function (req, res) {
  // res.send(tog(req.body));
  store.find({"url":req.body.url}).then(function(docs)
  {
    console.log(docs)
    if (!docs.length)
    {
      var bookmark = bk({},req.cookies.marx_user);
      bookmark.newBookmark(req.body);
      bookmark.countTags();
      bookmark.grabTags();

      var mark = bookmark.getBookmark();
      store.insert(mark).then(function(doc)
      {
        res.redirect('/view/'+doc._id);
      },function() { res.send("error adding to db"); });

    } else {

      var bookmark = bk(docs[0],req.cookies.marx_user);
      bookmark.updateBookmark(req.body);
      bookmark.countTags();
      bookmark.grabTags();

      var mark = bookmark.getBookmark();

      store.update({"_id":docs[0]._id},mark).then(function()
      {
        res.redirect('/view/'+docs[0]._id);
      },function() { res.send("error adding to db"); });
    }
  });
})

/*
  This route mops up all the other URLs for the site. This enables
  all the /tag/tag/ pages by just grabbing everything in the URL
  splitting it up and assuming they're all tags.
*/
router.get('/*', function (req, res) {
  var tags = _.without(req.params[0].split('/'),'');
  if (tags.length)
  {
    console.log(tags);
    // store.find({ tags: { $in:tags }}).then(function(docs)
    store.find({ tags:{ $all:tags }},{ sort:{ created: -1 }}).then(function(docs)
    {
      res.render('index',{"user":req.cookies.marx_user,"bookmarks":docs,"tags":tags});
    });
  } else {
    res.send('No tag specifido!')
  }
});

module.exports = router
