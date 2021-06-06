chrome.runtime.onInstalled.addListener(function() {
    //getLabelsForHistory();
});

function setDataToLocalStorage(key, data){
    chrome.storage.local.set({key: data});
}

function getLabelsForHistory() {
}

function getHeaderFromPage(doc) {
    var tags = [ "h1","h2","h3" ];

    for(var i = 0; i < tags.length; i++){
        let headText = doc.getElementsByTagName(tags[i]).innerHtml;
        if(headText && headText.length>0){
            return headText;
        }
    }
    return doc.title;
}