// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


var urlToCount = {};
var bookmakedUrls = [];
var filterQuery = '';
// Event listner for clicks on links in a browser action popup.
// Open the link in a new tab of the current window.
function onAnchorClick(event) {
    chrome.tabs.create({
      selected: true,
      url: event.srcElement.href
    });
    return false;
}

function setDataToLocalStorage(key, data){
  chrome.storage.local.set({key: data});
}

function getDataToLocalStorage(key){
    return chrome.storage.local.get(key);
  }

function getLocation(href) {
    var location = document.createElement("a");
    location.href = href;
    // IE doesn't populate all link properties when setting .href with a relative URL,
    // however .href will return an absolute URL which then can be used on itself
    // to populate these additional fields.
    if (location.host == "") {
        location.href = location.href;
    }
    return location;
};

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

var periods = {
  month: 30 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000
};

function formatTime(timeCreated) {
  var diff = Date.now() - timeCreated;

  if (diff > periods.month) {
    // it was at least a month ago
    return Math.floor(diff / periods.month) + " Months ago";
  } else if (diff > periods.week) {
    return Math.floor(diff / periods.week) + " Weeks ago";
  } else if (diff > periods.day) {
    return Math.floor(diff / periods.day) + " Days ago";
  } else if (diff > periods.hour) {
    return Math.floor(diff / periods.hour) + " Hours ago";
  } else if (diff > periods.minute) {
    return Math.floor(diff / periods.minute) + " Mins ago";
  }
  return "Just now";
}

var qrcode = null;

function showQRCode(url){
  console.log(url);
  var element = document.getElementsByClassName("mask");

  if(qrcode === null){
    qrcode = new QRCode(document.getElementById("qrcode"), {
      text: url,
      width: 300,
      height:250,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
  }
  document.getElementById("modalHeader").innerHTML = urlToCount[url].title;
  document.getElementById("modalHeader").title = urlToCount[url].title
  qrcode.makeCode(url);
  element[0].classList.add("active");
}

function addListneresForQRCode(){
  const elements = document.getElementsByClassName('hoverbutton');

  // adding the event listener by looping
  for(var i = 0;i<elements.length;i++){
    elements[i].addEventListener('click', (e)=>{
      showQRCode(e.target.title);
    });
  }

  const maskButton = document.getElementsByClassName('mask');
  function closeModal(){
    maskButton[0].classList.remove("active");
    qrcode.clear(); 
  }
  const closeButton = document.getElementsByClassName('close-modal');
  closeButton[0].addEventListener("click", function(){
    closeModal();
  });
  maskButton[0].addEventListener("click", function(){
    closeModal();
  });
}

function addListnersForFilters() {
  var card = document.getElementById("card");
  var cardRel = document.getElementById("card-relevency");
  document.getElementById("flip-host").addEventListener(
    "click",
    function(e) {
      e.preventDefault();
      const title = e.target.title;
      filterQuery = title;
      title === 'Host'? card.classList.add('flipped'): card.classList.remove('flipped');
      updateDOMBasedOnHostDtl(title);
    },
    false
  );
  document.getElementById("flip-rel").addEventListener(
    "click",
    function(e) {
      e.preventDefault();
      cardRel.classList.toggle("flipped");
    },
    false
  );
  document.getElementById("daysFilter").addEventListener('change',
    function(e) {
      e.preventDefault();
      updateDOMBasedOnHostDtl(filterQuery);
    },
    false);
}

function updateDOMBasedOnHostDtl(title) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    const currentUrl = tabs[0].url;
    const location = getLocation(currentUrl);
    const hostName = location.hostname;
    const searchQuery = title === 'Host'? '': hostName;
    buildTypedUrlList("container", searchQuery);
  });
}
  
  // Given an array of URLs, build a DOM list of those URLs in the
  // browser action popup.
function buildPopupDom(divName, data, isHostSearch) {
    var popupDiv = document.getElementById(divName);
    var dataContainer = '';
    popupDiv.innerHTML = dataContainer;
    document.getElementById('totalResultCount').innerHTML = data.length;
    for (var i = 0, ie = data.length; i < ie; ++i) {
      dataContainer += `<div id="cardContainer">
                            <div id="first">
                                <div id="firstTop">
                                    <div id="firstDisplay">
                                        <div id="linkDetail" title="${data[i].title}" >
                                            <a href="${data[i].url}" target="_blank">${data[i].title}</a>
                                        </div>
                                        <div id="linkAction">
                                            <i class="pad-5 glyphicon glyphicon-info-sign font-20" title="${data[i].url}"></i>
                                            ${data[i].isBookmarked?'<i class="pad-5 glyphicon glyphicon-bookmark" title="Bookmarked"></i>':''}
                                        </div>
                                    </div>
                                    <div id="firstDisplay">
                                        <div id="lastVisitTime">
                                          <span class="time-data"> Last Visit Time : ${formatTime(data[i].lastVisitTime)}</span>
                                        </div>
                                        <div id="linkAction">
                                          <div class="circle" title="Number of times hits in history">${data[i].count}</div>
                                          <i class="hoverbutton pad-5 glyphicon glyphicon-qrcode font-20" title="${data[i].url}"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>`;
    }
    popupDiv.innerHTML = dataContainer;
    addListneresForQRCode();
    addListnersForFilters();
  }
  
  // Search history to find up to ten links that a user has typed in,
  // and show those links in a popup.
  function buildTypedUrlList(divName, hostname, isHostSearch) {
    // To look for history items visited in the last week,
    // subtract a week of microseconds from the current time.
    var days = document.getElementById("daysFilter").value;
    var microsecondsPerWeek = 1000 * 60 * 60 * 24 * (days>0?days:7);
    var oneWeekAgo = (new Date).getTime() - microsecondsPerWeek;
  
    // Track the number of callbacks from chrome.history.getVisits()
    // that we expect to get.  When it reaches zero, we have all results.
    var numRequestsOutstanding = 0;
    chrome.history.search({
        'text': hostname,              // Return every history item....
        'startTime': oneWeekAgo  // that was accessed less than one week ago.
      },
      function(historyItems) {
        totalLength=historyItems.length;
        urlToCount={};
        // For each history item, get details on all visits.
        for (var i = 0; i < historyItems.length; ++i) {
          var url = historyItems[i].url;
          urlToCount[url] = {count: historyItems[i].visitCount, title: historyItems[i].title || url, lastVisitTime: historyItems[i].lastVisitTime}
        }
        onAllVisitsProcessed(isHostSearch);
    });

    var getBookmarkedUrl = function(treeNode, bookmarkUrlList) {
      if(treeNode.children) {
        treeNode.children.forEach(function(child) { 
          return getBookmarkedUrl(child, bookmarkUrlList); 
        });
      }
      // print leaf nodes URLs to console
      if(treeNode.url) { 
        bookmarkUrlList.add(treeNode.url); 
      }
      return bookmarkUrlList;
    }
  
    // Maps URLs to a count of the number of times the user typed that URL into
    // the omnibox.
  
    // This function is called when we have the final list of URls to display.
    var onAllVisitsProcessed = function(isHostSearch) {

      urlArray = [];
      if(bookmakedUrls.length===0){
        chrome.bookmarks.getTree(function(treeNode) {
          // Get the top scorring urls.
          if(treeNode.length>0){
            bookmakedUrls = getBookmarkedUrl(treeNode[0], new Set());
          }
          for (var url in urlToCount) {
            urlArray.push({url:url,count:urlToCount[url].count,title:urlToCount[url].title, lastVisitTime: urlToCount[url].lastVisitTime, isBookmarked: bookmakedUrls.has(url)});
          }
      
          // Sort the URLs by the number of times the user typed them.
          urlArray.sort(function(a, b) {
            return b.count - a.count;
          });
      
          buildPopupDom(divName, urlArray, isHostSearch);
        })
      } else {
        for (var url in urlToCount) {
          urlArray.push({url:url,count:urlToCount[url].count,title:urlToCount[url].title, lastVisitTime: urlToCount[url].lastVisitTime, isBookmarked: bookmakedUrls.has(url)});
        }
    
        // Sort the URLs by the number of times the user typed them.
        urlArray.sort(function(a, b) {
          return b.count - a.count;
        });
    
        buildPopupDom(divName, urlArray, isHostSearch);
      }
      
    };
  }

  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    const currentUrl = tabs[0].url;
    console.log(tabs[0].favIconUrl);
    const title = getHeaderFromPage(document);
    setDataToLocalStorage(tabs[0].url, {title:title})
    const location = getLocation(currentUrl);
    var header = document.getElementById("hostName");
    header.innerHTML = `<img class="header-icon" src="${tabs[0].favIconUrl?tabs[0].favIconUrl:'./images/world.png'}" title="${location.hostname}"></img><div class="header-text" title="${location.hostname}"><span class="header-span">${location.hostname} </span> <span id="totalResultCount" class="circle" title="Total Number Of Results"></span>
    <i class="hoverbutton pad-5 glyphicon glyphicon-qrcode font-30" title="${currentUrl}"></i></div>`;
    const search= location.hostname ? location.hostname: '';
    if(search.length = 0){
      document.getElementById("card").classList.add('flipped');
    }
    buildTypedUrlList("container", search, true);
  });