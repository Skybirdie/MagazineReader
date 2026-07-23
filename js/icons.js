"use strict";

window.IconManager={

set(buttonId,iconId){

const button=document.getElementById(buttonId);

if(!button)return;

const use=button.querySelector("use");

if(use){

use.setAttribute("href","#"+iconId);

}

},

setMute(muted){

this.set(

"muteButton",

muted?

"icon-muted":

"icon-volume"

);

},

toggleShelfButtons(shelf){

SkyReader.selectors.shelfViewButton
.classList.toggle("active",shelf);

SkyReader.selectors.listViewButton
.classList.toggle("active",!shelf);

},

flash(buttonId){

const button=document.getElementById(buttonId);

if(!button)return;

button.classList.add("flash");

setTimeout(()=>{

button.classList.remove("flash");

},180);

},

disable(buttonId){

const button=document.getElementById(buttonId);

if(button){

button.disabled=true;

}

},

enable(buttonId){

const button=document.getElementById(buttonId);

if(button){

button.disabled=false;

}

},

updateNavigation(){

this.disable("previousButton");

this.disable("nextButton");

if(SkyReader.currentPage>0){

this.enable("previousButton");

}

if(SkyReader.currentPage<

SkyReader.pageCount-1){

this.enable("nextButton");

}

}

};