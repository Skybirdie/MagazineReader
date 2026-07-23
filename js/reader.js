"use strict";

window.Reader={

pdf:null,

book:null,

pageRendering:false,

pagePending:null,

currentPage:1,

pageCount:0,

pageRatio:1,

renderScale:2,

pageCache:new Map(),

canvases:[],

activeCanvas:1,

viewer:null,

container:null,

loadingText:null,

loadingProgress:null,

async initialize(){

this.viewer=document.getElementById("viewerArea");

this.container=document.getElementById("pageContainer");

this.loadingText=document.getElementById("loadingText");

this.loadingProgress=document.getElementById("loadingProgress");

this.createCanvases();

},

createCanvases(){

this.canvases=[];

this.container.innerHTML="";

for(let i=0;i<3;i++){

const canvas=document.createElement("canvas");

canvas.className="pageCanvas";

canvas.style.display=i===1?"block":"none";

canvas.width=1;

canvas.height=1;

this.container.appendChild(canvas);

this.canvases.push({

canvas,

ctx:canvas.getContext("2d",{alpha:false})

});

}

},

async open(book){

this.book=book;

this.pageCache.clear();

this.currentPage=1;

this.pageCount=0;

SkyReader.currentMagazine=book;

SkyReader.resetViewer();

SkyReader.setLoading(0,"Opening "+book.title);

try{

const task=pdfjsLib.getDocument({

url:book.pdf,

enableXfa:false,

useSystemFonts:true

});

this.pdf=await task.promise;

this.pageCount=this.pdf.numPages;

this.restoreReadingPosition();

SkyReader.pageCount=this.pageCount;

const first=await this.pdf.getPage(1);

const viewport=first.getViewport({scale:1});

this.pageRatio=viewport.width/viewport.height;

SkyReader.pageRatio=this.pageRatio;

this.resize();

await this.renderCurrentPage();

await this.preloadAdjacentPages();

this.finishRender();
}
catch(err){

console.error(err);

SkyReader.setStatus("Unable to open PDF.");

}

},

resize(){

if(!this.viewer)return;

const pad=24;

const w=this.viewer.clientWidth-pad*2;

const h=this.viewer.clientHeight-pad*2;

let pageW=w;

let pageH=pageW/this.pageRatio;

if(pageH>h){

pageH=h;

pageW=pageH*this.pageRatio;

}

this.container.style.width=pageW+"px";

this.container.style.height=pageH+"px";

this.canvases.forEach(c=>{

c.canvas.style.width=pageW+"px";

c.canvas.style.height=pageH+"px";

});

},

async renderCurrentPage(){

if(this.pageRendering){

this.pagePending=this.currentPage;

return;

}

this.pageRendering=true;

SkyReader.setLoading(

Math.round(

(this.currentPage/this.pageCount)*100

),

"Rendering page "+this.currentPage

);

const page=await this.getPage(this.currentPage);

const viewport=page.getViewport({

scale:this.renderScale

});

const slot=this.canvases[this.activeCanvas];

slot.canvas.width=viewport.width;

slot.canvas.height=viewport.height;

await page.render({

canvasContext:slot.ctx,

viewport

}).promise;

await this.applyLinks(page,viewport);

this.pageRendering=false;

if(this.pagePending!==null){

const pending=this.pagePending;

this.pagePending=null;

this.currentPage=pending;

this.renderCurrentPage();

return;

}

StorageManager.savePage();

this.updateStatus();

this.finishRender();

},

async getPage(number){

if(this.pageCache.has(number)){

return this.pageCache.get(number);

}

const page=await this.pdf.getPage(number);

this.pageCache.set(number,page);

return page;

},

updateStatus(){

const status=document.getElementById("statusMessage");

if(!status)return;

status.textContent=

this.book.title+

"  •  "+

this.currentPage+

" / "+

this.pageCount;

},

next(){

if(this.currentPage>=this.pageCount)return;

this.currentPage++;

this.renderCurrentPage();

},

previous(){

if(this.currentPage<=1)return;

this.currentPage--;

this.renderCurrentPage();

},

goTo(page){

if(page<1)page=1;

if(page>this.pageCount)page=this.pageCount;

if(page===this.currentPage)return;

this.currentPage=page;

this.renderCurrentPage();

},

async applyLinks(page,viewport){

const old=

this.container.querySelectorAll(".pdfLink");

old.forEach(e=>e.remove());

const annotations=

await page.getAnnotations();

annotations.forEach(a=>{

if(a.subtype!=="Link")return;

const link=document.createElement("a");

link.className="pdfLink";

link.style.position="absolute";

const r=a.rect;

link.style.left=((r[0]/viewport.width)*100)+"%";

link.style.top=(((viewport.height-r[3])/viewport.height)*100)+"%";

link.style.width=(((r[2]-r[0])/viewport.width)*100)+"%";

link.style.height=(((r[3]-r[1])/viewport.height)*100)+"%";

link.style.zIndex="10";

if(a.url){

link.href=a.url;

link.target="_blank";

}
else if(a.dest){

link.href="#";

link.onclick=(e)=>{

e.preventDefault();

this.openDestination(a.dest);

};

}

this.container.appendChild(link);

});

}

};

window.addEventListener("resize",()=>{

if(window.Reader){

Reader.resize();

}

/* ==============================
   PART 3.1B
   Pre-rendering & Navigation
==============================*/

async preloadAdjacentPages(){

if(!this.pdf)return;

const previous=this.currentPage-1;
const next=this.currentPage+1;

if(previous>=1){

this.renderHidden(previous,0);

}

if(next<=this.pageCount){

this.renderHidden(next,2);

}

},

async renderHidden(pageNumber,canvasIndex){

const slot=this.canvases[canvasIndex];

if(!slot)return;

try{

const page=await this.getPage(pageNumber);

const viewport=page.getViewport({

scale:this.renderScale

});

slot.canvas.width=viewport.width;

slot.canvas.height=viewport.height;

await page.render({

canvasContext:slot.ctx,

viewport

}).promise;

}
catch(err){

console.warn(err);

}

},

swapTo(direction){

this.container.classList.remove(

"pageTurningLeft",

"pageTurningRight"

);

void this.container.offsetWidth;

this.container.classList.add(

direction==="next"

?

"pageTurningLeft"

:

"pageTurningRight"

);

setTimeout(()=>{

this.container.classList.remove(

"pageTurningLeft",

"pageTurningRight"

);

},340);

},

async nextPage(){

if(this.currentPage>=this.pageCount){

return;

}

this.swapTo("next");

this.currentPage++;

await this.renderCurrentPage();

await this.preloadAdjacentPages();

},

async previousPage(){

if(this.currentPage<=1){

return;

}

this.swapTo("previous");

this.currentPage--;

await this.renderCurrentPage();

await this.preloadAdjacentPages();

},

async goToPage(page){

page=Math.max(

1,

Math.min(page,this.pageCount)

);

if(page===this.currentPage){

return;

}

this.swapTo(

page>this.currentPage

?

"next"

:

"previous"

);

this.currentPage=page;

await this.renderCurrentPage();

await this.preloadAdjacentPages();

},

async openDestination(dest){

if(!dest)return;

const destination=

await this.pdf.getDestination(dest);

if(!destination)return;

const ref=destination[0];

const index=

await this.pdf.getPageIndex(ref);

this.goToPage(index+1);

},

wireControls(){

const previous=document.getElementById(

"previousButton"

);

const next=document.getElementById(

"nextButton"

);

if(previous){

previous.onclick=()=>{

this.previousPage();

};

}

if(next){

next.onclick=()=>{

this.nextPage();

};

}

document.addEventListener(

"keydown",

e=>{

if(

e.target.tagName==="INPUT"

)return;

switch(e.key){

case"ArrowRight":

this.nextPage();

break;

case"ArrowLeft":

this.previousPage();

break;

case"Home":

this.goToPage(1);

break;

case"End":

this.goToPage(this.pageCount);

break;

}

}

);

let wheelLock=false;

this.viewer.addEventListener(

"wheel",

e=>{

if(e.ctrlKey)return;

if(wheelLock)return;

wheelLock=true;

setTimeout(()=>{

wheelLock=false;

},350);

if(e.deltaY>0){

this.nextPage();

}else{

this.previousPage();

}

},

{passive:true}

);

},

async refresh(){

await this.renderCurrentPage();

await this.preloadAdjacentPages();

}

/* ==============================
   PART 3.1C
   Final Reader Integration
==============================*/

showCanvas(index){

this.canvases.forEach((slot,i)=>{

slot.canvas.style.display=

i===index

?

"block"

:

"none";

});

this.activeCanvas=index;

},

rememberReadingPosition(){

if(!this.book)return;

StorageManager.resume={

magazineId:this.book.id,

page:this.currentPage

};

if(StorageManager.saveResume){

StorageManager.saveResume();

}else{

localStorage.setItem(

"skyreader_resume",

JSON.stringify(StorageManager.resume)

);

}

},

restoreReadingPosition(){

let resume=null;

if(StorageManager.loadResume){

resume=StorageManager.loadResume();

}else{

try{

resume=JSON.parse(

localStorage.getItem(

"skyreader_resume"

)

);

}catch(e){}

}

if(!resume)return;

if(!this.book)return;

if(resume.magazineId!==this.book.id)return;

this.currentPage=

Math.max(

1,

Math.min(

resume.page||1,

this.pageCount

)

);

},

updatePageIndicator(){

const label=

document.getElementById(

"pageIndicator"

);

if(!label)return;

label.textContent=

this.currentPage+

" / "+

this.pageCount;

},

finishRender(){

this.showCanvas(1);

this.updateStatus();

this.updatePageIndicator();

this.rememberReadingPosition();

SkyReader.finishLoading(

this.book.title

);

},

close(){

this.pageCache.clear();

this.pdf=null;

this.book=null;

this.pageCount=0;

this.currentPage=1;

this.canvases.forEach(slot=>{

slot.ctx.clearRect(

0,

0,

slot.canvas.width,

slot.canvas.height

);

});

SkyReader.toggleLibrary(true);

},

destroy(){

this.close();

this.container.innerHTML="";

this.canvases=[];

},

async initializeReader(){

await this.initialize();

this.wireControls();

}

});