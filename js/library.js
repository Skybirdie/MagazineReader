{
"name":"SkyReader Library",
"version":"1.0",
"background":"assets/background.jpg",
"books":[
{
"id":"birds",
"title":"Birds of Trinidad",
"subtitle":"Nature Collection",
"thumbnail":"covers/birds.jpg",
"pdf":"pdf/birds.pdf"
},
{
"id":"travel",
"title":"Caribbean Travel",
"subtitle":"Issue 4",
"thumbnail":"covers/travel.jpg",
"pdf":"pdf/travel.pdf"
}
]
}

"use strict";

window.Library={

searchText:"",

build(){

this.buildShelf();

this.buildList();

this.updateContinueReading();

},

buildShelf(){

const shelf=

document.getElementById("shelfView");

shelf.innerHTML="";

SkyReader.filteredLibrary.forEach(book=>{

shelf.appendChild(

this.createShelfCard(book)

);

});

},

buildList(){

const list=

document.getElementById("listView");

list.innerHTML="";

SkyReader.filteredLibrary.forEach(book=>{

list.appendChild(

this.createListItem(book)

);

});

},

createShelfCard(book){

const card=document.createElement("div");

card.className="bookCard";

card.dataset.id=book.id;

const cover=document.createElement("div");

cover.className="bookCover";

const image=document.createElement("img");

image.loading="lazy";

image.src=book.thumbnail;

cover.appendChild(image);

const title=document.createElement("div");

title.className="bookTitle";

title.textContent=book.title;

const subtitle=document.createElement("div");

subtitle.className="bookSubtitle";

subtitle.textContent=

book.subtitle||"";

card.append(

cover,

title,

subtitle

);

card.onclick=()=>{

this.open(book.id);

};

return card;

},

createListItem(book){

const item=document.createElement("div");

item.className="listItem";

item.dataset.id=book.id;

item.innerHTML=

`

<div class="listThumb">

<img loading="lazy"

src="${book.thumbnail}">

</div>

<div class="listInfo">

<div class="listTitle">

${book.title}

</div>

<div class="listSubtitle">

${book.subtitle||""}

</div>

</div>

`;

item.onclick=()=>{

this.open(book.id);

};

return item;

},

filter(text){

this.searchText=text.toLowerCase();

SkyReader.filteredLibrary=

SkyReader.library.filter(book=>{

return(

book.title

.toLowerCase()

.includes(this.searchText)

||

(book.subtitle||"")

.toLowerCase()

.includes(this.searchText)

);

});

this.build();

},

updateContinueReading(){

const card=

document.getElementById("continueCard");

if(!SkyReader.resume.magazineId){

card.style.display="none";

return;

}

const book=

SkyReader.library.find(

b=>b.id===

SkyReader.resume.magazineId

);

if(!book){

card.style.display="none";

return;

}

card.style.display="flex";

card.innerHTML=

`

<div class="coverPlaceholder">

<img src="${book.thumbnail}"

style="width:100%;height:100%;object-fit:cover;border-radius:10px;">

</div>

<div class="placeholderText">

<h3>${book.title}</h3>

<p>

Continue on page

${SkyReader.resume.page+1}

</p>

</div>

`;

card.onclick=()=>{

this.open(book.id);

};

},

open(id){

const book=

SkyReader.library.find(

b=>b.id===id

);

if(!book)return;

SkyReader.currentMagazine=book;

StorageManager.save();

console.log(

"Opening",

book.title

);

/* reader.js will take over here */

}

initializeEvents(){

const search=document.getElementById("searchBox");

if(search){

search.addEventListener("input",e=>{

this.filter(e.target.value);

});

}

const shelfButton=document.getElementById("shelfViewButton");

if(shelfButton){

shelfButton.addEventListener("click",()=>{

this.showShelf();

});

}

const listButton=document.getElementById("listViewButton");

if(listButton){

listButton.addEventListener("click",()=>{

this.showList();

});

}

const libraryButton=document.getElementById("libraryButton");

if(libraryButton){

libraryButton.addEventListener("click",()=>{

this.toggleLibrary();

});

}

window.addEventListener("resize",()=>{

this.handleResize();

});

document.addEventListener("keydown",e=>{

this.handleKeyboard(e);

});

},

showShelf(){

SkyReader.toggleView(true);

StorageManager.setShelfView(true);

},

showList(){

SkyReader.toggleView(false);

StorageManager.setShelfView(false);

},

toggleLibrary(){

SkyReader.toggleLibrary();

},

handleResize(){

if(window.innerWidth>=1000){

SkyReader.toggleLibrary(true);

}

},

handleKeyboard(e){

if(e.target.tagName==="INPUT")return;

switch(e.key){

case "Escape":

SkyReader.toggleLibrary(true);

break;

case "l":

case "L":

this.toggleLibrary();

break;

case "/":

e.preventDefault();

const search=document.getElementById("searchBox");

if(search){

search.focus();
search.select();

}

break;

}

},

sortByTitle(){

SkyReader.filteredLibrary.sort((a,b)=>{

return a.title.localeCompare(b.title);

});

this.build();

},

sortNewest(){

SkyReader.filteredLibrary.sort((a,b)=>{

const da=new Date(a.date||0);

const db=new Date(b.date||0);

return db-da;

});

this.build();

},

sortRecent(){

const last=StorageManager.load();

if(!last.lastMagazine){

this.sortByTitle();

return;

}

SkyReader.filteredLibrary.sort((a,b)=>{

if(a.id===last.lastMagazine)return -1;

if(b.id===last.lastMagazine)return 1;

return a.title.localeCompare(b.title);

});

this.build();

},

openFirstBook(){

if(!SkyReader.filteredLibrary.length)return;

this.open(

SkyReader.filteredLibrary[0].id

);

},

refresh(){

this.build();

if(SkyReader.ui.shelfView){

this.showShelf();

}else{

this.showList();

}

},

initialize(){

this.build();

this.initializeEvents();

if(SkyReader.ui.shelfView){

this.showShelf();

}else{

this.showList();

}

this.handleResize();

}

};