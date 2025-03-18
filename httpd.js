const fs = require('fs');
const https = require('https');

//ssl証明書
const options = {
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.crt')
}

const PORT = 10443;
const document_root = "web/";//webコンテンツファイルの実際の配置場所指定


//シンボリックリンク張れない場合用のディレクトリ置換設定
//ここでは上の階層にあるnode_modulesをnpmとしている
//シンボリックリンクで対応する場合はここの設定は消す
const aliases = [
  {
    "org":"/npm/",
    "alt":"/../node_modules/",
  }
];
const resolve_alias = (url) =>{
  //エリアスに前方一致する場合は置換する
  for(const alias of aliases){
    if(url.indexOf(alias.org)===0){
      const tail = url.substring(alias.org.length);
      url = alias.alt+tail;
      break;
    }
  }
  return url;
}


https.createServer(options, (request, response)=>{
  //console.log(request);

  const _url = resolve_alias(request.url);
  //queryパラメータカットしないとファイル名にならない
  const _arr = _url.split("?");
  const url = _arr[0];

  const path = require('path');
  const info = path.parse(url);
  var local_path = document_root+url.substr(1);
  
  if(url=="/" ){
    local_path = document_root+"index.html";
    if(!fs.existsSync(local_path)){
      //ない場合
      response.writeHead(404);
      response.end();
    }else{
      response.writeHead(200,{
        "Content-Type": "text/html"
      });
      const data = fs.readFileSync(local_path);
      response.end(data);

    }
  }else if(url.endsWith("/")){
    local_path = local_path+"index.html";
    if(!fs.existsSync(local_path)){
      //ない場合
      response.writeHead(404);
      response.end();
    }else{
      response.writeHead(200,{
        "Content-Type": "text/html"
      });
      const data = fs.readFileSync(local_path);
      response.end(data);
    }
  }else if(!fs.existsSync(local_path)){
    //ない場合
    response.writeHead(404);
    response.end();
  } else if(info.ext==".js"){
    response.writeHead(200,{
      "Content-Type": "application/javascript"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);
  }else if(info.ext==".ico"){
    response.writeHead(200,{
      "Content-Type": "image/vnd.microsoft.icon"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);
  }else if(info.ext==".png"){
    response.writeHead(200,{
      "Content-Type": "image/png"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);
  }else if(info.ext==".jpg" || info.ext==".jpeg"){
    response.writeHead(200,{
      "Content-Type": "image/jpeg"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);

  }else if(info.ext==".html"){
    response.writeHead(200,{
      "Content-Type": "text/html"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);
  }else if(info.ext==".css"){
    response.writeHead(200,{
      "Content-Type": "text/css"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);

  }else{
    response.writeHead(200,{
      "Content-Type": "application/octet-stream"
    });
    const data = fs.readFileSync(local_path);
    response.end(data);
  }
}).listen(PORT);
