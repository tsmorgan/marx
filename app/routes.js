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

var count = 0;

store.count({},function(error,c){ count = c; });

function prepareTemplateData(req,obj)
{
  obj.total_marx = count;
  obj.user = req.cookies.marx_user;
  return obj;
}

/*
  Always check for the user cookie whatever page we're on
  If they don't have the it show the login screen instead.
*/
router.get("/*", function (req, res, next) {
  if (!req.cookies.marx_user)
  {
    res.render('login',prepareTemplateData(req,{"cookie":req.cookies,users:users}));
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
    res.render('index',prepareTemplateData(req,{"bookmarks":docs,"tags":['home']}));
  });
});

/*
  Add a new bookmark form.
*/
router.get('/add/', function (req, res) {
    res.render('form',prepareTemplateData(req,{"mark":req.query}));
});

/*
  Details page for each bookmark (by ID)
*/
router.get('/view/:id', function (req, res) {
  store.findOne({"_id":req.params.id}).then(function(doc)
  {
    if (doc)
    {
      res.render('view',prepareTemplateData(req,{"mark":doc}));
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
      res.render('form',prepareTemplateData(req,{"mark":mark}));
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
    store.count({},function(error,c){ count = c; });
    res.send(tog(doc));
  });
});

/*
  The route that the login form posts to. Just writes
  a cookie and passes you on to the home page.
*/
router.post('/login/', function (req, res) {
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
router.get('/logout/', function (req, res) {
  res.clearCookie('marx_user');
  res.redirect('/');
});

/*
  This page
*/
router.get('/tags/',function(req,res)
{
  store.aggregate([
    { $project: { tags:1 } },
    { $unwind : "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).then(function(docs)
  {
    res.render('tags',prepareTemplateData(req,{"tags":docs}));
  })
});

router.get('/search/',function(req,res)
{
  var searchTerm = req.query.q;
  store.find(
    { "$text": { "$search":searchTerm } },
    { score: { $meta:"textScore"} }
  ).then(function(docs) {
    res.render('results',prepareTemplateData(req,{"bookmarks":docs, "searchTerm":searchTerm}));
  });
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
        store.count({},function(error,c){ count = c; });
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
      res.render('index',prepareTemplateData(req,{"bookmarks":docs,"tags":tags}));
    });
  } else {
    res.send('No tag specifido!')
  }
});

module.exports = router
