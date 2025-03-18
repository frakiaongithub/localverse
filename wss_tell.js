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
  var connection_id  = tmp_id;
  
  //新参にwelcome
  const members =[];
  for(const uid in sockets){
    members.push(uid);
  }
  const welcome_msg = {"mode":"welcome","you":connection_id,"members":members};
  ws.send(JSON.stringify(welcome_msg));


  //既存にjoin
  for(const uid in sockets){
    if(uid!=connection_id){
      const uws = sockets[uid];
      const join_msg = {"mode":"join","id":connection_id};
      uws.send(JSON.stringify(join_msg));
    }
  }
  
  //送信してから管理変数に新参を積む
  sockets[connection_id]=ws;

  ws.on('close', (reasonCode, description) => {
    if(connection_id in sockets){
      //ほかのメンバーに離脱通知
      for(const uid in sockets){
        if(uid!=connection_id){
          const uws = sockets[uid];
          const leave_msg = {"mode":"leave","id":connection_id};
          uws.send(JSON.stringify(leave_msg));
        }
      }
      delete sockets[connection_id];//接続辞書から削除
    };
  })

  //receive message
  ws.on('message', function message(data,isBinary) {
    const message = isBinary ? data : data.toString();
    console.log("receive ",message);
    const info = JSON.parse(message);
    console.log(info);
    if(info.mode=="tell"){
      const sender = connection_id;
      const target = info.target;
      const message_body = info.message;
      if(target in sockets){
        const uws = sockets[target];
        const tell_msg = {"mode":"tell","sender":sender,"message":message_body};
        uws.send(JSON.stringify(tell_msg));
      }
    }
  });

});
server.listen(port);


