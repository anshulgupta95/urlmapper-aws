const express = require('express');
const router = express.Router();
const app = express();
const { DOMParser } = require('xmldom');
const cheerio = require('cheerio');
var logger = require('./utils/logger');
// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 3000;
const port = 3001;
// const port = process.env.NODE_PORT || 3000;
let sitemapFile = '/sitemap.xml';
// const fs = require('fs');
const axios = require('axios');
console.log(process.env.NODE_ENV);

// app.use(express.json());
app.use(express.json({ limit: '100MB' }));
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use('/', router);

router.get('/test', (req, res) => {
  logger.info('Server Sent A Hello World!');
  res.send('Hello from test!');
});

app.post('/estimator', (req, res) => {
  const url = req.body.url;
  const h1 = req.body.h1;
  // console.log('url', url);
  var length = 0;
  var sitemaps = 0;
  var loopSitemaps = 0;
  var count = 0;
  let allURLs = [];
  // let blogs = [];
  // let pages = [];
  let pageData = {};
  let allImages = [];
  let allPageLinks = [];
  let countPages = 0;
  let pdfPages = [];
  let failedURLs = [];
  let headerURLs = [];
  if (h1) {
    req.body.urls.forEach((pageUrl) => {
      let urlLen = req.body.urls.length;
      getH1Content(pageUrl, urlLen);
    });
  } else {
    // Get Sitemap content and parse it to DOM
    async function getSitemapURLs(sitemapFile, callback) {
      const sitemapURL = url + sitemapFile;
      console.log('checking sitemap exists:', sitemapURL);

      axios.get(sitemapURL)
        .then(function (response) {
          // handle success
          // console.log(response);
          var sitemapContent = response.data;
          console.log('siteContent: ');
          var XMLSitemap = parseXMLSitemap(sitemapContent);
          console.log('xml: ');
          sitemaps = XMLSitemap.getElementsByTagName('sitemap');
          // var subSitemapContent = undefined;
          console.log('sitemaps.length:', sitemaps.length);
          if (sitemaps !== undefined && sitemaps.length > 0) {
            for (var i = 0; i < sitemaps.length; i++) {
              console.log('subFileName: ', sitemaps[i].getElementsByTagName('loc')[0].textContent);
              axios.get(sitemaps[i].getElementsByTagName('loc')[0].textContent)
                .then(function (response) {
                  loopSitemaps = loopSitemaps + 1;
                  var subSitemapContent = response.data;
                  var subXMLSitemap = parseXMLSitemap(subSitemapContent);
                  console.log('sub: ', loopSitemaps, sitemaps.length);
                  if (loopSitemaps == sitemaps.length) {
                    callback(subXMLSitemap, "pass");
                  }
                  else {
                    callback(subXMLSitemap);
                  }
                })
            }
          }
          else {
            callback(XMLSitemap, "pass");
          }
        })
        .catch(function (error) {
          console.log('Calling nonsitemap fn:' + url);
          getNonSitemapURLS(url);
        })
    }

    // retrieving info from sitemap
    getSitemapURLs(sitemapFile, function (XMLSitemap, array_status) {
      try {
        var urls = XMLSitemap.getElementsByTagName('url');
        console.log('pulling urls from sitemap:');
        count++;

        for (var i = 0; i < urls.length; i++) {
          var urlElement = urls[i];
          var loc = urlElement.getElementsByTagName('loc')[0].textContent;
          allURLs.push(loc);
        }
        console.log('pages: ', array_status, allURLs);
        length = length + urls.length;
        if (array_status == "pass") {
          pageData = {
            allURLs: JSON.stringify(allURLs),
          };
          console.log('H1 no, sending Data: ', allURLs);
          res.send(pageData);
        }
      } catch (err) {
        console.log('err:', err);
      }
    });
  }

  async function getNonSitemapURLS(url) {
    try {
      console.log('url', url);
      const response = await axios.get(url);
      if (response.status === 200) {
        const html = response.data;
        let $ = cheerio.load(html);
        console.log('link count:', $('a').length);
        $('a').each(function () {
          var link = $(this);
          var linkUrl = link.attr('href');
          if (linkUrl !== '' && linkUrl != null && linkUrl !== undefined) {
            var newURL = '';
            if (linkUrl.charAt(0) === '/' || !linkUrl.startsWith('http')) {
              if (linkUrl.charAt(0) === '/') {
                linkUrl = linkUrl.substring(1);
              }
              newURL = url + "/" + linkUrl.split('#')[0];
              console.log('newURL:', newURL);
              if (!allPageLinks.includes(newURL) && !newURL.includes('tel') && newURL.startsWith(url)) {
                allPageLinks.push(newURL);
              }
            } else if (!allPageLinks.includes(linkUrl) && linkUrl.startsWith(url) && !linkUrl.includes('tel')) {
              allPageLinks.push(linkUrl);
            }
          }
        });
        allURLs = [];
        countPages = 0;
        allURLs = allPageLinks;
        console.log('allUrls length:', allURLs.length);
        console.log('allURLs:', allURLs);
        $ = "";
      }
      pageData = {
        allURLs: JSON.stringify(allURLs),
      };
      res.send(pageData);
    } catch (err) {
      console.log('err:', url, err);
    }
  }

  async function getH1Content(pageUrl, len) {
    try {
      // console.log("Pulling H1 for: ", pageUrl)
      const response = await axios.get(pageUrl);
      if (response.status == 200) {
        // console.log("H1 pulled: ", pageUrl);
        const html = response.data;
        let $ = cheerio.load(html);
        let q = $('h1').text();
        h1Val = {
          url: pageUrl,
          h1: q,
          statusCode: response.status
        };
        headerURLs.push(h1Val);
        countPages = countPages + 1;
        $ = "";
      }
      else {
        h1Val = {
          url: pageUrl,
          // h1: q,
          statusCode: response.status
        };
        headerURLs.push(h1Val);
        countPages = countPages + 1;
      }
      if (countPages == len) {
        pageData = {
          h1: JSON.stringify(headerURLs)
        };
        res.send(pageData);
        console.log("H1 sent from Green:", pageUrl);
      }

    } catch (err) {
      h1Val = {
        url: pageUrl
      };
      headerURLs.push(h1Val);
      countPages = countPages + 1;
      console.log('err:', pageUrl, err);
      pageData = {
        h1: JSON.stringify(headerURLs)
      };
      res.send(pageData);
      console.log("H1 sent from Red:", pageUrl);
    }
  }

  // parse a text string into an XML DOM object
  function parseXMLSitemap(sitemapContent) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(sitemapContent, 'text/xml');
    return xmlDoc;
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
