"use strict";

/*
=========================================================
 SkyReader Renderer
 Version 2.0
 PDF.js Rendering Engine

 Responsibilities

 • Load PDF documents
 • Render pages to canvas
 • Manage page cache
 • Resize viewer
 • Provide page navigation API
 • Render PDF hyperlinks

 No UI.
 No buttons.
 No audio.
 No gestures.

=========================================================
*/

window.Renderer=(function(){

const renderer={};

/*-------------------------------------------------------
  Internal State
-------------------------------------------------------*/

let pdf=null;

let currentBook=null;

let currentPage=1;

let pageCount=0;

let pageRatio=1;

let renderScale=2;

let viewer=null;

let pageContainer=null;

let canvas=null;

let ctx=null;

let cache=new Map();

let rendering=false;

let pendingPage=null;

let resizeObserver=null;

let currentViewport=null;

/*-------------------------------------------------------
  Events
-------------------------------------------------------*/

renderer.events={

progress:null,

ready:null,

page:null,

error:null

};

/*-------------------------------------------------------
  Initialization
-------------------------------------------------------*/

renderer.initialize=function(){

viewer=document.getElementById("viewerArea");

pageContainer=document.getElementById("pageContainer");

if(!viewer){

throw new Error(

"viewerArea not found."

);

}

if(!pageContainer){

throw new Error(

"pageContainer not found."

);

}

canvas=document.createElement("canvas");

canvas.className="pageCanvas";

ctx=canvas.getContext(

"2d",

{

alpha:false,

desynchronized:true

}

);

pageContainer.innerHTML="";

pageContainer.appendChild(canvas);

resizeObserver=

new ResizeObserver(()=>{

renderer.resize();

});

resizeObserver.observe(viewer);

};

/*-------------------------------------------------------
  Public Information
-------------------------------------------------------*/

renderer.page=function(){

return currentPage;

};

renderer.pages=function(){

return pageCount;

};

renderer.book=function(){

return currentBook;

};

renderer.loaded=function(){

return pdf!==null;

};

/*-------------------------------------------------------
  Events
-------------------------------------------------------*/

function emit(name,...args){

const fn=renderer.events[name];

if(typeof fn==="function"){

fn(...args);

}

}

function progress(percent,text){

emit(

"progress",

percent,

text

);

}

/*-------------------------------------------------------
  Document Loading
-------------------------------------------------------*/

renderer.open=

async function(book){

renderer.close();

currentBook=book;

progress(

5,

"Opening document"

);

try{

const task=

pdfjsLib.getDocument({

url:book.pdf,

enableXfa:false,

useSystemFonts:true

});

pdf=

await task.promise;

pageCount=

pdf.numPages;

const first=

await pdf.getPage(1);

currentViewport=

first.getViewport({

scale:1

});

pageRatio=

currentViewport.width/

currentViewport.height;

currentPage=1;

renderer.resize();

emit(

"ready",

book,

pageCount

);

await renderer.render(1);

}
catch(error){

emit(

"error",

error

);

}

};

/*-------------------------------------------------------
  Resize
-------------------------------------------------------*/

renderer.resize=function(){

if(

!viewer||

!pageRatio

){

return;

}

const padding=24;

const maxWidth=

viewer.clientWidth-

padding*2;

const maxHeight=

viewer.clientHeight-

padding*2;

let width=maxWidth;

let height=

width/pageRatio;

if(height>maxHeight){

height=maxHeight;

width=

height*pageRatio;

}

pageContainer.style.width=

width+"px";

pageContainer.style.height=

height+"px";

canvas.style.width=

width+"px";

canvas.style.height=

height+"px";

};

/*-------------------------------------------------------
  Page Cache
-------------------------------------------------------*/

async function getPage(number){

if(cache.has(number)){

return cache.get(number);

}

const page=

await pdf.getPage(number);

cache.set(

number,

page

);

return page;

}

/*-------------------------------------------------------
  Rendering
-------------------------------------------------------*/

renderer.render=async function(pageNumber){

if(!pdf)return;

pageNumber=Math.max(

1,

Math.min(

pageCount,

pageNumber

)

);

pendingPage=pageNumber;

if(rendering){

return;

}

rendering=true;

while(pendingPage!==null){

const target=pendingPage;

pendingPage=null;

await renderInternal(target);

}

rendering=false;

};

async function renderInternal(pageNumber){

progress(

Math.round(

(pageNumber/pageCount)*100

),

"Rendering page "+pageNumber

);

const page=

await getPage(pageNumber);

const viewport=

page.getViewport({

scale:renderScale

});

currentViewport=viewport;

canvas.width=

viewport.width;

canvas.height=

viewport.height;

ctx.setTransform(

1,

0,

0,

1,

0,

0

);

ctx.clearRect(

0,

0,

canvas.width,

canvas.height

);

await page.render({

canvasContext:ctx,

viewport

}).promise;

currentPage=pageNumber;

renderer.resize();

await renderLinks(

page,

viewport

);

trimCache();

emit(

"page",

currentPage,

pageCount

);

}

/*-------------------------------------------------------
  Hyperlinks
-------------------------------------------------------*/

async function renderLinks(page,viewport){

pageContainer

.querySelectorAll(".pdfLink")

.forEach(link=>link.remove());

const annotations=

await page.getAnnotations();

for(const annotation of annotations){

if(annotation.subtype!=="Link"){

continue;

}

const link=

document.createElement("a");

link.className="pdfLink";

link.style.position="absolute";

link.style.left=

(annotation.rect[0]/viewport.width*100)+"%";

link.style.top=

((viewport.height-

annotation.rect[3])

/

viewport.height

*100)+"%";

link.style.width=

((annotation.rect[2]-annotation.rect[0])

/

viewport.width

*100)+"%";

link.style.height=

((annotation.rect[3]-annotation.rect[1])

/

viewport.height

*100)+"%";

link.style.cursor="pointer";

link.style.background="transparent";

link.style.zIndex="100";

if(annotation.url){

link.href=annotation.url;

link.target="_blank";

}

else if(annotation.dest){

link.href="#";

link.onclick=async event=>{

event.preventDefault();

const destination=

await pdf.getDestination(

annotation.dest

);

if(!destination){

return;

}

const pageIndex=

await pdf.getPageIndex(

destination[0]

);

renderer.goTo(

pageIndex+1

);

};

}

pageContainer.appendChild(link);

}

}

/*-------------------------------------------------------
  Cache
-------------------------------------------------------*/

function trimCache(){

const keep=[

currentPage-2,

currentPage-1,

currentPage,

currentPage+1,

currentPage+2

];

for(const key of cache.keys()){

if(

!keep.includes(key)

){

cache.delete(key);

}

}

}


/*-------------------------------------------------------
  Navigation
-------------------------------------------------------*/

renderer.next=function(){

if(!pdf)return;

if(currentPage>=pageCount)return;

renderer.render(currentPage+1);

};

renderer.previous=function(){

if(!pdf)return;

if(currentPage<=1)return;

renderer.render(currentPage-1);

};

renderer.goTo=function(page){

if(!pdf)return;

page=Math.max(

1,

Math.min(

page,

pageCount

)

);

renderer.render(page);

};

/*-------------------------------------------------------
  Public Utilities
-------------------------------------------------------*/

renderer.refresh=function(){

if(!pdf)return;

renderer.render(currentPage);

};

renderer.statistics=function(){

return{

book:currentBook,

currentPage,

pageCount,

cachedPages:cache.size,

renderScale,

rendering

};

};

/*-------------------------------------------------------
  Cleanup
-------------------------------------------------------*/

renderer.close=function(){

pendingPage=null;

rendering=false;

cache.clear();

currentBook=null;

currentPage=1;

pageCount=0;

pageRatio=1;

currentViewport=null;

if(pdf){

try{

pdf.destroy();

}catch(e){}

}

pdf=null;

pageContainer

.querySelectorAll(".pdfLink")

.forEach(link=>link.remove());

if(ctx){

ctx.setTransform(

1,

0,

0,

1,

0,

0

);

ctx.clearRect(

0,

0,

canvas.width,

canvas.height

);

}

canvas.width=1;

canvas.height=1;

};

renderer.destroy=function(){

renderer.close();

if(resizeObserver){

resizeObserver.disconnect();

resizeObserver=null;

}

if(canvas&&canvas.parentNode){

canvas.parentNode.removeChild(canvas);

}

canvas=null;

ctx=null;

viewer=null;

pageContainer=null;

};

/*-------------------------------------------------------
  Event Registration
-------------------------------------------------------*/

renderer.on=function(name,callback){

if(

Object.prototype.hasOwnProperty.call(

renderer.events,

name

)

){

renderer.events[name]=callback;

}

return renderer;

};

/*-------------------------------------------------------
  Configuration
-------------------------------------------------------*/

renderer.setRenderScale=function(scale){

scale=Math.max(

1,

Math.min(

4,

Number(scale)||2

)

);

renderScale=scale;

if(pdf){

renderer.refresh();

}

};

renderer.getRenderScale=function(){

return renderScale;

};

/*-------------------------------------------------------
  Version
-------------------------------------------------------*/

renderer.version="2.0.0";

/*-------------------------------------------------------
  Export
-------------------------------------------------------*/

return renderer;

})();

/*-------------------------------------------------------
  Automatic Initialization
-------------------------------------------------------*/

document.addEventListener(

"DOMContentLoaded",

()=>{

Renderer.initialize();

});
