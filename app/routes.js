var express     = require('express'),
    _           = require('lodash'),
    router      = express.Router(),
    db_url      = process.env.MONGOLAB_URI || 'mongodb://localhost/marx',
    db_url      = 'mongodb://localhost/marx',
    db          = require('monk')(db_url),
    tog         = require(__dirname + '../../lib/tog.js'),
    bk          = require(__dirname + '/bookmark.js');

var store = db.get('bookmarks');

router.get('*', function (req, res, next) {
  if (!req.cookies.marx_user)
  {
    res.render('login',{"cookie":req.cookies});
  } else {
    next();
  }
});

router.get('/', function (req, res) {
  store.find({}).then(function(docs)
  {
    res.render('index',{"bookmarks":docs});
  });
});

router.get('/test/', function (req, res) {
  store.find({ tags: { $in: ["fish","flash"] }}).then(function(docs)
  {
    res.render('index',{"bookmarks":docs});
  });
});

router.get('/add/', function (req, res) {
    res.render('form',{"cookie":req.cookies.marx_user, "mark":req.query});
});

router.get('/tag/*', function (req, res) {
  var tags = _.without(req.params[0].split('/'),'');
  if (tags.length)
  {
    console.log(tags);
    // store.find({ tags: { $in:tags }}).then(function(docs)
    store.find({ tags:{ $all:tags }},{ sort:{ created: -1 }}).then(function(docs)
    {
      res.render('index',{"bookmarks":docs});
    });
  } else {
    res.send('No tag specifido!')
  }
  
});

router.get('/edit/:id', function (req, res) {
  store.findOne({"_id":req.params.id}).then(function(doc)
  {
    var mark = { _id: doc._id, url: doc.url, title: doc.title }
    var h = _.findIndex(doc.humans, ['user', req.cookies.marx_user]);
    if (h > -1)
    {
      mark.user = doc.humans[h].user;
      mark.desc = doc.humans[h].desc;
      mark.tags = doc.humans[h].tags; 
    }
    // res.send(tog(mark));
    res.render('form',{"cookie":req.cookies.marx_user, "mark":mark});
  });
});

router.post('/api/login/', function (req, res) {
  // res.send(tog(req.body));
  var randomNumber=Math.random().toString();
  randomNumber=randomNumber.substring(2,randomNumber.length);
  res.cookie('marx_user',req.body.username, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
  res.redirect('/');
});

router.get('/api/logout/', function (req, res) {
  res.clearCookie('marx_user');
  res.redirect('/');
});

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
      store.insert(mark).then(function()
      {
        res.send("added bookmark: "+tog(mark));
      },function() { res.send("error adding to db"); });

    } else {
      
      var bookmark = bk(docs[0],req.cookies.marx_user);
      bookmark.updateBookmark(req.body);
      bookmark.countTags();
      bookmark.grabTags();
      
      var mark = bookmark.getBookmark();
      
      store.update({"_id":docs[0]._id},mark).then(function()
      {
        res.send("updated bookmark: "+tog(mark));
      },function() { res.send("error adding to db"); });
    }
  });
})

// add your routes here

module.exports = router
