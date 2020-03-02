const fs = require('fs');
const archieml = require('archieml');
const request = require('request');
const url = require('url');
const htmlparser = require('htmlparser2');
const Entities = require('html-entities').AllHtmlEntities;

const CWD = process.cwd();
const CONFIG_PATH = `${CWD}/config.json`;
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const { doc } = CONFIG.google;

const makeRequest = (opt, cb) => {
  const docUrl = `https://docs.google.com/document/d/${opt.id}/export?format=html`;
  request(docUrl, (error, response, body) => {
    if (error) console.log(error);
    else if (response) {
      var handler = new htmlparser.DomHandler(function(error, dom) {
	 
	var tagHandlers = {
	  _base: function (tag) {
	    var str = '';
	    tag.children.forEach(function(child) {
	      if (func = tagHandlers[child.name || child.type]) str += func(child);
	    });
	    return str;
	  },
	  text: function (textTag) { 
	    return textTag.data; 
	  },
	  span: function (spanTag) {
	    return tagHandlers._base(spanTag);
	  },
	  p: function (pTag) { 
	    return tagHandlers._base(pTag) + '\n'; 
	  },
	  a: function (aTag) {
	    var href = aTag.attribs.href;
	    if (href === undefined) return '';
	    // extract real URLs from Google's tracking
	    // from: http://www.google.com/url?q=http%3A%2F%2Fwww.nytimes.com...
	    // to: http://www.nytimes.com...
	    if (aTag.attribs.href && url.parse(aTag.attribs.href,true).query && url.parse(aTag.attribs.href,true).query.q) {
	      href = url.parse(aTag.attribs.href,true).query.q;
	    }

	    var str = '<a href="' + href + '">';
	    str += tagHandlers._base(aTag);
	    str += '</a>';
	    return str;
	  },
	  li: function (tag) {
	    return '* ' + tagHandlers._base(tag) + '\n';
	  }
	};

	['ul', 'ol'].forEach(function(tag) {
	  tagHandlers[tag] = tagHandlers.span;
	});
	['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function(tag) {
	  tagHandlers[tag] = tagHandlers.p;
	});

        const unparsed = dom[0].children[1];
        var parsedText = tagHandlers._base(unparsed);
        console.log(parsedText);
        var entities = new Entities();
        parsedText = entities.decode(parsedText);
        parsedText = parsedText.replace(/<[^<>]*>/g, function(match){
         return match.replace(/”|“/g, '"').replace(/‘|’/g, "'");
        }); 
        const parsed = archieml.load(parsedText);
        const str = JSON.stringify(parsed);
        const file = `${CWD}/${opt.filepath || 'data/doc.json'}`;
	fs.writeFile(file, str, err => {
          if (err) console.error(err);
          cb();
        });
    });
    var parser = new htmlparser.Parser(handler);
    parser.write(body);
    parser.done();
  }
  });
}

function init() {
  let i = 0;
  const next = () => {
    const d = doc[i];
    if (d.id)
      makeRequest(d, () => {
        i += 1;
        if (i < doc.length) next();
        else process.exit();
      });
  };

  next();
}

init();
