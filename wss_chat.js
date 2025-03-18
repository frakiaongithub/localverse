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

var sockets = {};//接続idをキーとしてwebsocketを値とする

wss.on('connection', function connection(ws,req) {
  //connect時
  let tmp_id = uuidv4();//接続idを作る
  //重複時は作り直し
  while(tmp_id in sockets){
    tmp_id = uuidv4();
  }
  //接続id確定
  var connection_id = tmp_id;
  ws.send("あなたのID "+connection_id);
  sockets[connection_id]=ws;
  
  //参加通知
  for(const uid in sockets){
    if(uid!=connection_id){
      const uws = sockets[uid];
      uws.send( connection_id + "が参加しました");
    }
  }

  ws.on('close', (reasonCode, description) => {
    if(connection_id in sockets){
      //ほかのメンバーに離脱通知
      for(const uid in sockets){
        if(uid!=connection_id){
          const uws = sockets[uid];
          uws.send( connection_id + "が離脱しました");
        }
      }
      delete sockets[connection_id];//接続辞書から削除
    };
  })

  //receive message
  ws.on('message', function message(data,isBinary) {
    const message = isBinary ? data : data.toString();
    for(const uid in sockets){
      const uws = sockets[uid];
      uws.send(connection_id + "の発言:" + message);
    }
  });

});
server.listen(port);


