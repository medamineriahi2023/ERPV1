const jsonServer = require('json-server');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Paths to your SSL certificate and key
const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// Create JSON Server
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(router);

// Start HTTPS server
https.createServer(options, server).listen(3000, () => {
  console.log('JSON Server is running on https://localhost:3000');
});