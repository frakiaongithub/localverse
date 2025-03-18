const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Buffer } = require('node:buffer');
const https = require('https');
const WebSocket = require('ws');

const LOGIN_TIMEOUT = 5*60;//ログイン猶予時間 sec
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
var accounts = {};//ユーザーIDをキーとしてパスワードと名前を値とする
var tokens = {};//トークンをキーとしてユーザーIDと寿命を値とする。
var users = {};//接続idをキーとしてユーザーIDと名前とインスタンス名を値とする。ログインした接続のみ
var instances = {};//インスタンス名をキーとしてインスタンスにいる接続idのリストを値とする。

//アカウント情報を読み込む処理
const loadAccount = (account_file) =>{
  if(!fs.existsSync(account_file)){
    console.log("not found userlist ",account_file);
    return ;
  }
  users = {};
  let txt_users = fs.readFileSync(account_file, {encoding: 'utf-8'});
  const __users = txt_users.split("\n");
  for(const __line of __users){
    const user_id_pw_name = __line.split(",");
    const user_id = user_id_pw_name[0].trim();
    const pw = user_id_pw_name[1].trim();
    const name = user_id_pw_name[2].trim();
    accounts[user_id]={password:pw,name:name};
  }
  console.log("get userlist ",accounts);
}
const account_file = "config/users.csv";//アカウント設定ファイルの場所 userid,password,nameな形式のcsv
//今回は起動時だけ読み込む
loadAccount(account_file);




wss.on('connection', function connection(ws,req) {
  //connect時
  let tmp_id = uuidv4();//接続idを作る
  //重複時は作り直し
  while(tmp_id in sockets){
    tmp_id = uuidv4();
  }
  //接続id確定
  //ここのスコープだとws単位になる
  var connection_id = tmp_id;
  
  //制限時間以内にログインしない場合は切断する
  const timeoutId = setTimeout(()=>{
    if(!(connection_id in users)){
      console.log("connection timeout ",connection_id);
      ws.close();
    }
  },LOGIN_TIMEOUT*1000);

  
  //ログインするまでは参加はしていない扱いなのでusersには積まない
  sockets[connection_id]=ws;

  ws.on('close', (reasonCode, description) => {
    console.log("disconnect",connection_id,users);
    clearTimeout(timeoutId);
    
    if(connection_id in users ){
      //ほかのメンバーに離脱通知
      const instance_name = users[connection_id]["instance"];
      console.log("in users instance=",instance_name);
      if(instance_name in instances){

        const member_list = instances[instance_name];
        console.log("in instance members=",member_list);

        for(const uid of member_list){
          console.log(uid,connection_id)
          if(uid!=connection_id){
            if(uid in sockets){
              const uws = sockets[uid];
              const leave_msg = {"mode":"leave","id":connection_id};
              console.log("send leave",leave_msg);
              uws.send(JSON.stringify(leave_msg));
            }
          }
        }
        //instances更新
        const idx = member_list.indexOf(connection_id);
        if(idx >= 0){
          instances[instance_name].splice(idx, 1);
        }
        //トークンに寿命を付与する
        const token = users[connection_id]["token"];
        if(token in tokens){
          //ページ移動の間だけ維持すればいいので30秒で無効にする
          tokens[token]["expiration"] = Date.now() + 30*1000;
        }
        delete users[connection_id];
      }
    };
    if(connection_id in sockets){
      delete sockets[connection_id];//接続辞書から削除
    }
  })
  
  
  
  const sendLoginMessages = (conn_id) =>{
    //auth/login成功時のwelcomeとjoinの送信処理
    
    const user_id = users[conn_id]["user_id"];
    const name = users[conn_id]["name"];
    const instance_name = users[conn_id]["instance"];
    const token = users[conn_id]["token"];

    //既存ユーザーがすでにいる場合は双方にsameuserを送信する。
    //このチェックは全インスタンスについて確認する
    const sameusers = [];
    for(const uid in users){
      if(users[uid]["user_id"] == user_id){
        sameusers.push(uid);
      }
    };
    if(sameusers.length>1){
      //自身を含めて送信する。
      const sameuser_msg = {"mode":"sameuser"};
      for(const uid of sameusers){
        if(uid in sockets){
          const uws = sockets[uid];
          uws.send(JSON.stringify(sameuser_msg));
        }
      }
    }
    
    
    
    //welcome送信
    console.log(instances,instance_name);
    const others = instances[instance_name].filter((id)=>{
      return id != conn_id
    });
    const members = [];
    for(uid of others){
      if(uid in users){
        members.push({"id":uid,"name":users[uid]["name"]});
      }
    }
    const welcome_msg = {"mode":"welcome","id":conn_id,"name":name,"members":members,"token":token};
    ws.send(JSON.stringify(welcome_msg));
    
    //join送信
    const join_msg = {"mode":"join","id":conn_id,"name":name};
    for(uid of others){
      if(uid in sockets){
        const uws = sockets[uid];
        uws.send(JSON.stringify(join_msg));
      }
    }
    
    
  };
  
  //receive message
  ws.on('message', function message(data,isBinary) {
    const message = isBinary ? data : data.toString();
    console.log("receive ",message);
    const info = JSON.parse(message);
    console.log(info);
    if(info.mode=="auth"){
      //トークン認証
      const token = info.token;
      const instance_name = info.world + "?room=" + info.room;
      let need_login = true;
      if(token in tokens){
        const ti = tokens[token];
        const user_id = ti["user_id"];
        const expiration = ti["expiration"];
        if("expiration" in ti){
          if(!( user_id in accounts)){
            //ユーザー自体がない
            //基本的にはあり得ない
          }else if( expiration> Date.now()){
            //有効
            need_login=false;
            //寿命消す
            delete tokens[token]["expiration"];
          }else{
            //寿命切れなので消す
            delete tokens[token];
          }
        }else{
          //この時点で寿命未定義なのは本来おかしい。
          //怪しいので通さない
        };
        if(!need_login){
          //ログイン状態に遷移
          if(! (instance_name in instances )){
            //インスタンスないので追加する
            instances[instance_name]=[];
          };
          if( !instances[instance_name].includes(connection_id)){
            instances[instance_name].push(connection_id);
          };
          
          //ユーザーリストに登録
          users[connection_id] = {"user_id":ti["user_id"],"name":accounts[ti.user_id]["name"],"instance":instance_name,"token":info.token};
          //メッセージ送信
          sendLoginMessages(connection_id);
          return;
        }
      }
      if(need_login){
        //ログイン要求
        const need_login_msg = {"mode":"need_login"};
        ws.send(JSON.stringify(need_login_msg));
        return;
      }
      
    }else if(info.mode=="login"){
      //idとパスワードによる認証
      const user_id = info.user_id;
      const password = info.password;
      const instance_name = info.world + "?room=" + info.room;
      let need_login = true;
      if(!(user_id in accounts)){
        //無効なユーザーid
        console.log("unknown user_id",user_id);
      }else if( password != accounts[user_id]["password"]){
        console.log("unmatch password",password);
        //無効なパスワード
        //もし既存ユーザーに同じアカウントがあったらattackedを通知する
        const attacked_msg = {"mode":"attacked"}
        for(const uid in users){
          if(users[uid]["user_id"]==user_id){
            if(uid in sockets){
              const uws = sockets[uid];
              uws.send(JSON.stringify(attacked_msg));
            }
          }
        }
      }else{
        //ログイン可能
        console.log("login ok");
        need_login = false;
      };
      if(need_login){
        //ログイン要求
        const need_login_msg = {"mode":"need_login"};
        ws.send(JSON.stringify(need_login_msg));
        return;
      }else{
        //トークン発行
        let token = Buffer.from(uuidv4()).toString('base64') ;
        //重複したら作り直し
        while(token in tokens){
          token = Buffer.from(uuidv4()).toString('base64') ;
        }
        tokens[token]={"user_id":user_id};
        //この時点では寿命を持たない

        //ログイン状態に遷移
        if(! (instance_name in instances )){
          //インスタンスないので追加する
          instances[instance_name]=[];
        };
        if( !instances[instance_name].includes(connection_id)){
          instances[instance_name].push(connection_id);
        };
        
        //ユーザー登録
        users[connection_id] = {"user_id":user_id,"name": accounts[user_id]["name"],"instance":instance_name,"token":token};

        //メッセージ送信
        sendLoginMessages(connection_id);
      }

    }else if(info.mode=="tell"){
      const sender = connection_id;
      const target = info.target;
      const message_body = info.message;
      if((sender in users) && (target in users)){
        //両方ログイン状態でないと転送しない。
        if(users[sender]["instance"] == users[target]["instance"]){
          //同じインスタンスにいないと転送しない
          if(target in sockets){
            const uws = sockets[target];
            const tell_msg = {"mode":"tell","sender":sender,"message":message_body};
            uws.send(JSON.stringify(tell_msg));
          }
        }
      }
    }
  });

});
server.listen(port);


