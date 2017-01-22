var _ = require('lodash');

function Bookmark(bk,user)
{
  var bookmark = bk;
  var user = user;
  
  return {
    
    newBookmark: function(data)
    {
      console.log("newBookmark")
      _.assign(bookmark,{
        "url":  data.url,
        "title": data.title,
        "humans": [
            {
              "user": user,
              "desc": data.desc,
              "tags": _.uniq(data.tags.split(', ')),
              "updated": new Date()
            }
        ],
        "created": new Date(),
        "updated": new Date()
      });
      console.log(bookmark)
    },
    
    updateBookmark: function(data)
    {
      bookmark.title = data.title;
      bookmark.updated = new Date();
      var h = _.findIndex(bookmark.humans,['user',user]);
      if (h >= 0)
      {
        bookmark.humans[h].desc = data.desc;
        bookmark.humans[h].tags = data.tags.split(', ');
        bookmark.humans[h].updated = new Date();
      } else {
        bookmark.humans.push({
          "user": user,
          "desc": data.desc,
          "tags": data.tags.split(', '),
          "updated": new Date()
        });
      }
    },
    
    countTags: function()
    {
      var count = {};
      for (var i = 0; i < bookmark.humans.length; i++)
      {
        var human = bookmark.humans[i];
        for (var i = 0; i < human.tags.length; i++)
        {
          var tag = human.tags[i];
          count[tag] = (count[tag]) ? count[tag] + 1 : 1;
        }
      }
      bookmark.tagCount = count;
      return bookmark;
    },
    
    grabTags: function()
    {
      var tags = [];
      for (var i = 0; i < bookmark.humans.length; i++)
      {
        tags = _.concat(tags,bookmark.humans[i].tags)
      }
      bookmark.tags = _.uniq(tags);
    },
    
    getBookmark: function()
    {
      return bookmark;
    }
  }
}

module.exports = Bookmark;
