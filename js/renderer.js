"use strict";

window.Renderer={

pdf:null,

currentBook:null,

currentPage:1,

pageCount:0,

pageRatio:1,

renderScale:2,

canvasPool:[],

cache:new Map(),

renderQueue:[],

rendering:false,

viewer:null,

container:null,

callbacks:{

onProgress:null,

onReady:null,

onPageRendered:null,

onError:null

},

initialize(){

this.viewer=document.getElementById("viewerArea");

this.container=document.getElementById("pageContainer");

this.createCanvasPool();

window.addEventListener(

"resize",

()=>{

this.resize();

}

);

},

createCanvasPool(){

this.canvasPool=[];

this.container.innerHTML="";

for(let i=0;i<3;i++){

const canvas=document.createElement("canvas");

canvas.className="pageCanvas";

canvas.width=1;

canvas.height=1;

canvas.style.display=

i===1

?

"block"

:

"none";

this.container.appendChild(canvas);

this.canvasPool.push({

canvas,

ctx:canvas.getContext(

"2d",

{

alpha:false,

desynchronized:true

}

),

page:null

});

}

},

async open(book){

this.clear();

this.currentBook=book;

this.emitProgress(

5,

"Opening PDF..."

);

try{

const task=

pdfjsLib.getDocument({

url:book.pdf,

enableXfa:false,

useSystemFonts:true,

isEvalSupported:true

});

this.pdf=

await task.promise;

this.pageCount=

this.pdf.numPages;

const first=

await this.pdf.getPage(1);

const viewport=

first.getViewport({

scale:1

});

this.pageRatio=

viewport.width/

viewport.height;

this.currentPage=1;

this.resize();

this.emitReady();

}
catch(err){

this.emitError(err);

}

},

resize(){

if(

!this.viewer||

!this.pageRatio

)return;

const padding=24;

const maxWidth=

this.viewer.clientWidth-

padding*2;

const maxHeight=

this.viewer.clientHeight-

padding*2;

let width=maxWidth;

let height=

width/

this.pageRatio;

if(height>maxHeight){

height=maxHeight;

width=

height*

this.pageRatio;

}

this.container.style.width=

width+"px";

this.container.style.height=

height+"px";

this.canvasPool.forEach(slot=>{

slot.canvas.style.width=

width+"px";

slot.canvas.style.height=

height+"px";

});

},

async getPage(number){

if(

this.cache.has(number)

){

return this.cache.get(number);

}

const page=

await this.pdf.getPage(number);

this.cache.set(

number,

page

);

return page;

},

queue(pageNumber){

if(

pageNumber<1||

pageNumber>

this.pageCount

){

return;

}

if(

this.renderQueue.includes(

pageNumber

)

){

return;

}

this.renderQueue.push(

pageNumber

);

this.processQueue();

},

async processQueue(){

if(

this.rendering

)return;

if(

!this.renderQueue.length

)return;

this.rendering=true;

const next=

this.renderQueue.shift();

await this.renderPage(next);

this.rendering=false;

if(

this.renderQueue.length

){

this.processQueue();

}

},

async renderPage(pageNumber){

if(!this.pdf)return;

try{

const page=

await this.getPage(pageNumber);

const viewport=

page.getViewport({

scale:this.renderScale

});

const slot=

this.getAvailableCanvas();

slot.page=pageNumber;

slot.canvas.width=viewport.width;

slot.canvas.height=viewport.height;

slot.ctx.clearRect(

0,

0,

slot.canvas.width,

slot.canvas.height

);

this.emitProgress(

Math.round(

(pageNumber/this.pageCount)*100

),

"Rendering page "+pageNumber

);

await page.render({

canvasContext:slot.ctx,

viewport

}).promise;

await this.renderAnnotations(

page,

viewport,

slot.canvas

);

this.showCanvas(slot);

this.emitPageRendered(pageNumber);

this.prefetch(pageNumber);

}
catch(err){

this.emitError(err);

}

},

getAvailableCanvas(){

let candidate=this.canvasPool.find(

c=>c.page===null

);

if(candidate)return candidate;

candidate=this.canvasPool.shift();

this.canvasPool.push(candidate);

return candidate;

},

showCanvas(active){

this.canvasPool.forEach(slot=>{

slot.canvas.style.display=

slot===active

?

"block"

:

"none";

});

},

async prefetch(pageNumber){

const targets=[

pageNumber-1,

pageNumber+1

];

for(const p of targets){

if(

p<1||

p>this.pageCount

)continue;

if(

this.cache.has("render_"+p)

)continue;

this.renderPreview(p);

}

},

async renderPreview(pageNumber){

try{

const page=

await this.getPage(pageNumber);

const viewport=

page.getViewport({

scale:1

});

const canvas=

document.createElement("canvas");

canvas.width=

viewport.width;

canvas.height=

viewport.height;

await page.render({

canvasContext:

canvas.getContext("2d"),

viewport

}).promise;

this.cache.set(

"render_"+pageNumber,

canvas

);

}
catch(err){

console.warn(err);

}

},

renderCurrent(){

this.queue(

this.currentPage

);

},

next(){

if(

this.currentPage>=

this.pageCount

)return;

this.currentPage++;

this.renderCurrent();

},

previous(){

if(

this.currentPage<=1

)return;

this.currentPage--;

this.renderCurrent();

},

goTo(page){

page=Math.max(

1,

Math.min(

page,

this.pageCount

)

);

if(

page===this.currentPage

)return;

this.currentPage=page;

this.renderCurrent();

},

refresh(){

this.renderCurrent();

},

statistics(){

return{

pages:this.pageCount,

cachedPages:

this.cache.size,

queue:

this.renderQueue.length,

canvasPool:

this.canvasPool.length,

currentPage:

this.currentPage

};

},

renderAnnotations(page,viewport,canvas){

const old=

this.container.querySelectorAll(

".pdfLink"

);

old.forEach(link=>link.remove());

page.getAnnotations().then(

annotations=>{

annotations.forEach(a=>{

if(a.subtype!=="Link")return;

const link=

document.createElement("a");

link.className="pdfLink";

link.style.position="absolute";

link.style.left=

((a.rect[0]/viewport.width)*100)+"%";

link.style.top=

(((viewport.height-a.rect[3])/

viewport.height)*100)+"%";

link.style.width=

(((a.rect[2]-a.rect[0])/

viewport.width)*100)+"%";

link.style.height=

(((a.rect[3]-a.rect[1])/

viewport.height)*100)+"%";

link.style.zIndex="100";

link.style.cursor="pointer";

link.style.background="transparent";

if(a.url){

link.href=a.url;

link.target="_blank";

}

else if(a.dest){

link.href="#";

link.onclick=async(e)=>{

e.preventDefault();

try{

const destination=

await this.pdf.getDestination(a.dest);

if(!destination)return;

const ref=

destination[0];

const pageIndex=

await this.pdf.getPageIndex(ref);

this.goTo(pageIndex+1);

}
catch(err){

console.warn(err);

}

};

}

this.container.appendChild(link);

});

}

);

},

emitProgress(percent,message){

if(

typeof this.callbacks.onProgress===

"function"

){

this.callbacks.onProgress(

percent,

message

);

}

},

emitReady(){

if(

typeof this.callbacks.onReady===

"function"

){

this.callbacks.onReady(

this.pdf,

this.pageCount

);

}

},

emitPageRendered(page){

if(

typeof this.callbacks.onPageRendered===

"function"

){

this.callbacks.onPageRendered(

page

);

}

},

emitError(error){

console.error(error);

if(

typeof this.callbacks.onError===

"function"

){

this.callbacks.onError(

error

);

}

},

trimCache(){

const keep=[

this.currentPage-2,

this.currentPage-1,

this.currentPage,

this.currentPage+1,

this.currentPage+2

];

for(const key of this.cache.keys()){

if(typeof key!=="number")

continue;

if(!keep.includes(key)){

this.cache.delete(key);

}

}

},

closeDocument(){

this.renderQueue=[];

this.rendering=false;

this.cache.clear();

this.currentBook=null;

this.currentPage=1;

this.pageCount=0;

this.pageRatio=1;

this.pdf=null;

this.canvasPool.forEach(slot=>{

slot.page=null;

slot.ctx.clearRect(

0,

0,

slot.canvas.width,

slot.canvas.height

);

});

const links=

this.container.querySelectorAll(

".pdfLink"

);

links.forEach(

l=>l.remove()

);

},

destroy(){

this.closeDocument();

this.container.innerHTML="";

this.canvasPool=[];

},

setCallbacks(callbacks={}){

Object.assign(

this.callbacks,

callbacks

);

},

getCurrentPage(){

return this.currentPage;

},

getPageCount(){

return this.pageCount;

},

getCurrentBook(){

return this.currentBook;

},

isLoaded(){

return this.pdf!==null;

}

};

document.addEventListener(

"DOMContentLoaded",

()=>{

Renderer.initialize();

});
