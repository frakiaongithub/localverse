const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const WebSocket = require('ws');

const port = 10514;

//ssl証明書
const ssl_server_key = 'ssl/server.key';
const ssl_server_crt = 'ssl/server.crt';

const server = https.createServer({
  key: fs.readFileSync(ssl_server_key).toString(),
  cert: fs.readFileSync(ssl_server_crt).toString()
});
wss = new WebSocket.Server({
  maxPayload: 1024 * 1024,
  server 
});

wss.on('connection', function connection(ws,req) {
  ws.send("welcome");

  ws.on('close', (reasonCode, description) => {
    //切断時
  })

  ws.on('message', function message(data,isBinary) {
    //受信時
    const message = isBinary ? data : data.toString();
    //echoサーバなのでそのまま返す
    ws.send(message);
  });

});
server.listen(port);


