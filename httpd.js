const port=80;
const aliases = [
  {
    "org":"/npm/",
    "alt":"/../node_modules/",
  }
];
const resolve_alias = (url) =>{
  for(const alias of aliases){
    if(url.indexOf(alias.org)===0){
      const tail = url.substring(alias.org.length);
      url = alias.alt+tail;
      break;
    }
  }
  return url;
}

const put_resource = (response,resource_path,content_type="text/html")=>{
  if(fs.existsSync(resource_path)){
    response.writeHead(200,{
      "Content-Type": content_type
    });
    const data = fs.readFileSync(resource_path);
    response.end(data);
  }else{
    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("404 Not Found\n");
    response.end();
  }
}

const fs = require('fs');
const http = require("http");
const document_root = "web/";
const server = http.createServer((request, response) => {
  console.log(request.url);
  const _url = resolve_alias(request.url);
  const _arr = _url.split("?");
  const url = _arr[0];
  const path = require('path');
  const info = path.parse(url);
  const local_path = document_root+url.substr(1);
  if(url=="/" ){
    const resource_path = document_root+"index.html";
    put_resource(response,resource_path,"text/html");
  }else if(url.endsWith("/")){
    const resource_path = local_path+"index.html";
    put_resource(response,resource_path,"text/html");
  }else if(!fs.existsSync(local_path)){
    put_resource(response,local_path,"text/html");
  } else if(info.ext==".js"){
    put_resource(response,local_path,"application/javascript");
  }else if(info.ext==".ico"){
    put_resource(response,local_path,"image/vnd.microsoft.icon");
  }else if(info.ext==".png"){
    put_resource(response,local_path,"image/png");
  }else if(info.ext==".jpg" || info.ext==".jpeg"){
    put_resource(response,local_path,"image/jpeg");
  }else if(info.ext==".txt"){
    put_resource(response,local_path,"text/plain");
  }else if(info.ext==".html"){
    put_resource(response,local_path,"text/html");
  }else if(info.ext==".css"){
    put_resource(response,local_path,"text/css");
  }else{
    put_resource(response,local_path,"application/octet-stream");
  }
});
server.listen(port);