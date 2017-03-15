(function() {

  "use strict";

  let express = require('express'),
    app = express(),
    path = require('path'),
    url = require('url'),
    http = require('http'),
    https = require('https'),
    bodyParser = require('body-parser'),
    zipper = require('./cssom.js');



  http.Server(app).listen(5555, function() {
  	console.log('Server is listening at localhost:5555');
  });

  //中间件提供静态资源 js/css/image 等， 会解析public文件夹下的文件
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
  });

  app.use(bodyParser.urlencoded({ extended: true }));

  app.post('/zip', function(req, res) {
    zipper(req.body.html, req.body.css, req.body.js);
  });
}());