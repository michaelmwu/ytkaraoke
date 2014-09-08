// Load Youtube API
var tag = document.createElement('script');
tag.src = "http://www.youtube.com/player_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

INITIAL_VIDEO = 'oxbB3NGJO6g';

// Key Constants
BACKSPACE = 8;
ENTER = 13;
PAUSE_BREAK = 19;
//DEL = 46;
SPACEBAR = 32;
LEFT_ARROW = 37;
UP_ARROW = 38;
RIGHT_ARROW = 39;
DOWN_ARROW = 40;
//ESC = 27;
//CAPS = 20;
//TAB = 9;
PGUP = 33;
PGDN = 34;
Q_KEY = 81;
S_KEY = 83;
Z_KEY = 90;
C_KEY = 67;
B_KEY = 66;
X_KEY = 88;
V_KEY = 86;
//SLASH_KEY = 191;
F1_KEY = 112;
H_KEY = 72;
/*NO1_KEY = 49;
NO2_KEY = 50;
NO3_KEY = 51;
NO4_KEY = 52;
NO5_KEY = 53;
NO6_KEY = 54;
NO7_KEY = 55;
NO8_KEY = 56;
NO9_KEY = 57;*/

// Timing constants
QUEUE_SHOW_TIME = 'fast';
QUEUE_HIDE_TIME = 'slow';

SEARCH_SHOW_TIME = 'fast';
SEARCH_HIDE_TIME = 'slow';

SEARCH_THROTTLE_TIME = 200;

HELP_SHOW_TIME = 30000;
HELP_HIDE_TIME = 'fast';

DIALOG_SHOW_TIME = 'fast';
DIALOG_HIDE_TIME = 'fast';

QUEUE_MSG_SHOW_TIME = 3000;
NEXT_SHOW_TIME = 5000;
BAR_SHOW_TIME = 6000;

// Maximum number of items to display in the manager
// MANAGER_COUNT = 20;

// State variables
var current = null;
var queue = [];
var previous = [];

var videos = [];

PERPAGE_MIN = 3;
PERPAGE_MAX = 10;

SEARCH_MAX = 1000;

var perPage = PERPAGE_MIN;
var perDisplayed = 0;
var searchTotal = SEARCH_MAX;
var startIndex = 1;

var playerState = 0;
var searchBarState = 1;
var oldSearch = '';
var oldFilter = '';
var aboutOpen = false;
var managerOpen = false;
var filterThrottle = false;
var throttle = false;
var suggested = '';
var curRequest = null;
var queueItemWidth;
var searchItemHeight = 113;
var searchWidth;

var popular = [];
var pi = 0;

// Bar messages
var barMsgTimeout;
var barHovered = false;
var dragging = false;
var msgQueue = [];

var lastFocused;
var windowFocused = true;
var itemFocused = false;

// Popup window
var popupWin = null;

function calculateDims() {
  searchItemHeight = $('#results .searchItem:first').outerHeight(true);
  
  calculatePerPage();
}

function openPopup() {
  hideSearch();
	var url = "karaoke-pop.html#tab=0"
  var keyword = $('#searchBox').val();
  if(keyword != '') {
    url += "&q=" + encodeURIComponent(keyword);
  }
	if( !popupWin || popupWin.closed ) {
		popupWin = window.open( url, "popupWin", "location=0,height=590,width=560" );
	}
  else {
    popupWin.focus();
    sendQueue();
  }
}

function setHash(hash){
  hash = $.trim(hash);
  window.location.replace("#"+encodeURI(hash));
}

function getHash() {
  return decodeURIComponent(window.location.hash.substring(1));
}

function sendQueue() {
	if(popupWin && !popupWin.closed) {
		// The popup is open so call it
		popupWin.recvQueue(queue);
	}
}

function recvQueue(nqueue) {
	queue = nqueue;
  updateQueueDisplay();
}

// Dialog manager
var dialogs = [];
function removeDialog(dlg) {
  for(var i=0;i<dialogs.length;i++){
    if(dialogs[i].attr('id')==dlg.attr('id')){
      dialogs.remove(i);
      return;
    }
  }
}

Z_BASE = 3;

// Add and focus
function addDialog(dlg) {
  removeDialog(dlg);
  dialogs.push(dlg);
  for(var i=0;i<dialogs.length;i++){
    dialogs[i].css('z-index', Z_BASE + i);
  }
}

function onDialogFocus() {
  addDialog($(this));
}

function onDialogClose() {
  removeDialog($(this));
}

function getCurrentTitle() {
  if(current) {
    return current.title;
  }
  else {
    return false;
  }
}

function getNextTitle() {
  if(queue.length > 1) {
    return 'Next: ' + queue[1].title;
  }
  else {
    return false;
  }
}

function barMsg(msg, time) {
  if(typeof time == 'undefined')
    time = QUEUE_MSG_SHOW_TIME;
  
  msgQueue.length = 0;
  if(!dragging) {
    msgQueue.push({msg: msg, time: time});
      
    processMessages();
  }
}

function barMsgReset() {
  $('#queueCell').fadeIn();
  $('#barMsg').fadeOut();
  msgQueue.length = 0;
  if(barMsgTimeout) {
    clearTimeout(barMsgTimeout);
    barMsgTimeout = null;
  }
  
  if(!(barHovered || dragging)) {
    processMessages();
  }
}

function addNext() {
  if(queue.length > 1)
    msgQueue.push({msg: 'Next: ' + queue[1].title, time: NEXT_SHOW_TIME});
}

function addCurrent() {
  if(current) {
    msgQueue.push({msg: current.title, time: NEXT_SHOW_TIME, stop: addNext});
  }
}

function processMessages() {
  if(msgQueue.length == 0) {
    if(current && queue.length == 0)
      msgQueue.push({msg: current.title, time: -1});
    else
      msgQueue.push({msg: false, time: BAR_SHOW_TIME, stop: addCurrent});
  }
  
  var item = msgQueue.shift(); 
  
  var msg = (typeof item.msg == 'function' ? item.msg() : item.msg);
  
  if(!msg) {
    $('#queueCell').fadeIn();
    $('#barMsg').fadeOut();
  }
  else {
    $('#queueCell').fadeOut();
    $('#barMsg').html(msg);
    $('#barMsg').fadeIn();
  }
  
  if(barMsgTimeout) {
    clearTimeout(barMsgTimeout);
    barMsgTimeout = null;
  }
  if(item.time && item.time > 0) {
    barMsgTimeout = setTimeout(function(){if(typeof item.stop=='function'){item.stop()}processMessages()}, item.time);
  }
}

function onBarMouseEnter() {
  barHovered = true;
  if(queue.length > 0)
    barMsgReset();
  //$('#controlCell').fadeIn();
}

function onBarMouseLeave() {
  barHovered = false;
  if(queue.length > 0)
    barMsgReset();
  //$('#controlCell').fadeOut();
}

function msgNext() {
  if(queue.length > 1) {
    barMsg('Next: ' + queue[1].title, NEXT_SHOW_TIME);
  }
}

function run() {
  // Array Remove - By John Resig (MIT Licensed)
  Array.prototype.remove = function(from, to) {
    if(typeof to == "undefined") {
      to = from + 1;
    }
    var rest = this.slice(to || from + 1 || this.length);
    var slice = this.slice(from, (to || from + 1));
    this.length = from < 0 ? this.length + from : from;
    this.push.apply(this, rest);
    return slice;
  };
  
  // String trim
  String.prototype.ltrim = function() {
    return this.replace(/^\s+/,"");
  }

  // Notify
  $('#container').notify();

  searchWidth = $('#videoCell').css('right');
  queueItemWidth = $('#queue > div:first').outerWidth(true);
  
  $('#shinedays').load(calculateDims);
  $('#shinedays').attr('src','shinedays.jpg');
  
  $('#barCell,#queueDrop').click(onBarClick);
  
  // Mac/Mobile
  if($.client.os == 'Mac') {
    $('#winhelp').hide();
    $('#machelp').show();
  }
  else if(isMobile()) {
    $('#winhelp').hide();
    $('#mobilehelp').show();
    showAbout();
  }
  
  $('#managerFilter').val('');
  $('#managerFilter').keyup(onFilterKeyUp);
  $('#managerFilter').focus(onFilterFocus);
  $('#managerFilter').blur(onFilterBlur);
  $('#managerFilter').keydown(onFilterKeyDown);
  $('#manager').draggable({scroll: false, cancel: '#managerQueue ul, #managerForm', containment: 'window'});
  $('#manager').mousedown(onDialogFocus);
  $('#manager').click(clickManager);
  
  // Clear out the search box and focus
  hash = getHash();
  $('#searchBox').val(hash);
  if(hash.length > 0) {
    setHash('');
  }
  $('#searchBox').focus(onSearchFocus);
  $('#searchBox').blur(onSearchBlur);
  $('#searchBox').focus();
  setAutoFocus($('#searchBox'));
  
  $('#suggestBox').focus(onSuggestFocus);
  $('#suggestBox').val('');
  
  $('#searchText').css('font-family', $('#searchBox').css('font-family'));
  $('#searchText').css('font-size', $('#searchBox').css('font-size'));
  
  $('#suggestText').css('font-family', $('#searchBox').css('font-family'));
  $('#suggestText').css('font-size', $('#searchBox').css('font-size'));
  
  $('#about').draggable({scroll: false, containment: 'window'});
  $('#about').mousedown(onDialogFocus);
  $('#about').click(toggleAbout);
  
  $('#aboutLink').click(toggleAbout);
  
  // Prevent form submission
  $('#searchForm').submit(searchSubmit);
  
  $('#barCell').mousedown(onDialogFocus);
  $('#barCell').hover(onBarMouseEnter, onBarMouseLeave);
  $('#queue').sortable({update: queueSort, floats: true, tolerance: 'pointer'});
  addDialog($('#barCell'));
  
  $(window).blur(onWindowBlur);
  $(window).focus(onWindowFocus);
  $(window).resize(onWindowResize);
  
  $(document).mousewheel(onMouseWheel);
  
  $('#popupLink').click(openPopup);
  
  setInterval(lastFocus, 300);
}

function onMouseWheel(e, d) {
  if(d > 0) {
    searchControl(PGUP);
  }
  else if(d < 0) {
    searchControl(PGDN);
  }
}

function setAutoFocus(obj) {
  lastFocused = obj;
  itemFocused = false;
}

function lastFocus() {
  if(windowFocused && lastFocused && !itemFocused) {
    lastFocused.focus();
    itemFocused = true;
  }
}

function nextPopular() {
  if(popular.length > 0) {
    if(pi >= popular.length) {
      pi = 0;
      popular.sort(function() {return 0.5 - Math.random()});
    }
    
    var video = popular[pi++];
    barMsg(video.title, -1);
    loadNotifyVideo(video);
  }
}

function getPopular() {
  var the_url='http://gdata.youtube.com/feeds/api/standardfeeds/most_popular_Music?alt=jsonc&v=2&format=5&max-results=50';
  var the_url2='http://gdata.youtube.com/feeds/api/videos?q=karaoke+lyrics&format=5&v=2&alt=jsonc&max-results=50';
  var barrier = 0;
  
  $.ajax({
    type: "GET",
    url: the_url,
    dataType:"jsonp",
    success: function(responseData, textStatus, XMLHttpRequest) {
      if (responseData.data.items) {
        popular.push.apply(popular, responseData.data.items);
      }
      
      if(++barrier == 2) {
        pi = popular.length;
        if(!current)
          setCurrentVideo(0);
      }
    }
  });
  
  $.ajax({
    type: "GET",
    url: the_url2,
    dataType:"jsonp",
    success: function(responseData, textStatus, XMLHttpRequest) {
      if (responseData.data.items) {
        popular.push.apply(popular, responseData.data.items);
      }
      
      if(++barrier == 2) {
        pi = popular.length;
        if(!current)
          setCurrentVideo(0);
      }
    }
  });
}

function keepInWindow(obj) {
  var winBottom = $(window).height();
  var bottom = obj.offset().top + obj.outerHeight();
  
  var winRight = $(window).width();
  var right = obj.offset().left + obj.outerWidth();
  var offset = obj.offset();
  
  if(bottom > winBottom || right > winRight) {
    if(bottom > winBottom) {
      offset.top = Math.max(0, winBottom - obj.outerHeight());
    }
    if(right > winRight) {
      offset.left = Math.max(0, winRight - obj.outerWidth());
    }
    obj.offset(offset);
  }
}

function centerH(obj,par) {
  if(typeof par == "undefined") {
    par = $(window);
  }
  obj.css("left", (par.width() - obj.width())/2  + 'px');
}

function centerV(obj,par) {
  if(typeof par == "undefined") {
    par = $(window);
  }
  obj.css("top", (par.height() - obj.height())/2  + 'px');
}

function center(obj,par) {
  if(typeof par == "undefined") {
    par = $(window);
  }
  centerH(obj,par);
  centerV(obj,par);
}

function showAbout() {
  aboutOpen = true;
  center($('#about'),$('#videoCell'));
  addDialog($('#about'));
  $('#about').fadeIn(DIALOG_SHOW_TIME);
}

function toggleAbout() {
  // Check if inside addthis box
  if(!aboutOpen) {
    showAbout();
  }
  else {
    aboutOpen = false;
    $('#about').fadeOut(DIALOG_HIDE_TIME);
    removeDialog($('#about'));
  }
  
  return false;
}

count = 0;

function clickManager(e) {
  var queueClick = $(e.target).parents('#managerQueue, #managerForm').length > 0;
  
  if(!queueClick) {
    toggleManager();
    return false;
  }
  else {
    return true;
  }
}

function onBarClick(e) {
  var queueClick = $(e.target).parents('#queueCell, #controlCell').length > 0;
  
  if(!queueClick) {
    toggleManager();
  }
}

function toggleManager() { 
  if(!managerOpen) {
    managerOpen = true;
    center($('#manager'), $('#videoCell'));
    addDialog($('#manager'));
    $('#manager').fadeIn(DIALOG_SHOW_TIME);
    if(queue.length > 0) {
      setAutoFocus($('#managerFilter'));
    }
  }
  else {
    managerOpen = false;
    $('#manager').fadeOut(DIALOG_HIDE_TIME);
    removeDialog($('#manager'));
    setAutoFocus($('#searchBox'));
  }
}

function onFilterKeyUp(e) {
  if(!filterThrottle) {
    throttledFilter();
  }
  
  if (filterTrapKey(e.keyCode)) {
    e.stopPropagation();
  }
}

function onFilterFocus() {
  lastFocused = $('#managerFilter');
  itemFocused = true;
}

function onFilterBlur() {
  itemFocused = false;
}

function onFilterKeyDown(e) {
  if (filterTrapKey(e.keyCode)) {
    e.stopPropagation();
  }
}

function filterTrapKey(keyCode) {
  var filter = $('#managerFilter').val();
  return (filter != '' && keyCode == BACKSPACE);
}

function throttledFilter() {
  filterThrottle = false;

  var filter = $('#managerFilter').val().toLowerCase();
  if(oldFilter != filter) {
    filterThrottle = true;
    oldFilter = filter;
    updateManagerDisplay();
    setTimeout(function(){throttledFilter(false)}, SEARCH_THROTTLE_TIME);
  }
}

function onYoutubePlayerReady(playerId) {
  // Get popular videos
  getPopular();
  $('#searchBox').keyup(onSearchKeyUp);
  $('#searchBox').input(onSearchInput);
  $('#searchBox').keydown(onSearchKeyDown);
  
  throttledSearch();
  
  $(document.documentElement).keydown(onKeyDown);
  $(document.documentElement).keyup(onKeyUp);
   
  // Show about for the first time
  if(!$.cookie("first-ytkaraoke")) {
    showAbout();
    var timeout = setTimeout(function(){toggleAbout();$('#about').unbind('click.first')},HELP_SHOW_TIME);
    $('#about').bind('click.first', function(){window.clearTimeout(timeout);$('#about').unbind('click.first');$('#searchBox').focus()});
    $.cookie("first-ytkaraoke", true, {expires: 365*1, path: '/'})
  }
}

function searchSubmit() {	
  return false;
}

function onPlayerStateChange(event) {
  var state = event.data;

  // Ended, move to next song
  if(state == 0) {
    forceNextVideo();
  }
  
  if(state == 1 || state == 3) {
    $('#controlPlayPause').attr('src', 'pause-24.png');
  }
  else if(state != -1) {
    $('#controlPlayPause').attr('src', 'play-24.png');
  }
  
  if(popupWin && !popupWin.closed) {
    popupWin.onPlayerStateChange(state);
  }
  playerState = state;
}

function onPlayerError() {
  forceNextVideo();
}

// Document key handling
function onKeyDown(e){
  var altCtrl = $.client.os == 'Mac' ? e.ctrlKey : e.altKey;
  
  if (altCtrl && (e.keyCode == V_KEY || e.keyCode == RIGHT_ARROW)) {
    forceNextVideo();
    return false;
  }
  else if (altCtrl && (e.keyCode == X_KEY || e.keyCode == LEFT_ARROW)) {
    prevVideo();
    return false;
  }
  else if((altCtrl && e.keyCode == C_KEY) || (($.client.os == 'Mac' ? e.ctrlKey : e.shiftKey) && e.keyCode == SPACEBAR) || e.keyCode == PAUSE_BREAK) {
    playPauseVideo();
    return false;
  }
  else if(altCtrl && e.keyCode == Q_KEY) {
    toggleManager(e);
    return false;
  }
  else if(e.keyCode == UP_ARROW) {
    hideQueue();
    return false;
  }
  else if(e.keyCode == DOWN_ARROW) {
    showQueue();
    return false;
  }
  else if(e.keyCode == F1_KEY || (altCtrl && e.keyCode == H_KEY)) {
    toggleAbout();
    return false;
  }
  else if(altCtrl && e.keyCode == S_KEY) {
    toggleSearch();
    return false;
  }
  else if(!dragging && (e.keyCode == PGUP || e.keyCode == PGDN)) {
    searchControl(e.keyCode);
    return false;
  }
  
  return e.keyCode != BACKSPACE;
}

function onKeyUp(e){
  return e.keyCode != BACKSPACE;
}

function hideQueue() {
  $('#barCell').animate({top: -85}, QUEUE_HIDE_TIME);
  removeDialog($('#barCell'));
}

function showQueue() {
  addDialog($('#barCell'));
  $('#barCell').animate({top: 0}, QUEUE_SHOW_TIME);
}

function toggleSearch() {
  if(searchBarState == 1) {
    hideSearch();
  }
  else {
    showSearch();
  }
}

function hideSearch() {
  $('#searchCell').animate({right: '-' + searchWidth}, SEARCH_HIDE_TIME).animate({opacity: 0}, 0);
  $('#funstuff').animate({right: '-' + searchWidth}, SEARCH_HIDE_TIME).animate({opacity: 0}, 0);
  $('#videoCell').animate({right: 0}, SEARCH_HIDE_TIME);
  if(lastFocused == $('#searchBox')) {
    setAutoFocus(null);
  }
  searchBarState = 0;
}

function showSearch() {
  $('#searchCell').animate({opacity: 1}, 0).animate({right: 0}, SEARCH_HIDE_TIME);
  $('#funstuff').animate({opacity: 1}, 0).animate({right: 0}, SEARCH_HIDE_TIME);
  $('#videoCell').animate({right: searchWidth}, SEARCH_HIDE_TIME);
  if(!lastFocused) {
    setAutoFocus($('#searchBox'));
  }
  searchBarState = 1;
}

function forceNextVideo() {
  setCurrentVideo(1);
}

function nextVideo() {
  if(queue.length > 1) {
    previous.unshift(queue[0]);
    setCurrentVideo(1);
  }
  else if(queue.length == 0) {
    nextPopular();
  }
}

function prevVideo() {
  if(previous.length > 0) {
    queue.unshift(previous.shift());
    setCurrentVideo(0);
    updateQueueDisplay();
  }
}

function onYouTubePlayerAPIReady() {
  ytplayer = new YT.Player('innerVideoCell', {
    height: '100%',
    width: '100%',
    videoId: INITIAL_VIDEO,
    playerVars: {
      //autohide: 1,
      enablejsapi: 1,
      origin: window.location.hostname,
      wmode: 'transparent'
    },
    events: {
      'onReady': onYoutubePlayerReady,
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
}

// Key events not to propagate up from the search bar
function searchTrapKey(keyCode) {
  return keyCode == BACKSPACE;
}

var forceSearch = false;
var suggestEnabled = true;

function throttledSearch() {
  throttle = false;

  var keyword = $('#searchBox').val();
  if(oldSearch != keyword || forceSearch) {
    throttle = true;
    oldSearch = keyword;
    if(suggestEnabled) {
      suggest(keyword);
    }
    else {
      search(keyword, startIndex, perPage);
    }
    forceSearch = false;
    setTimeout(function(){throttledSearch(false)}, SEARCH_THROTTLE_TIME);
  }
}

function onSearchKeyUp(e) {  
  if (searchTrapKey(e.keyCode)) {
    e.stopPropagation();
  }
}

function onSearchInput(e) {
  // Kill suggested if it doesn't match up!
  var keyword = $('#searchBox').val();
  $('#searchText').html(keyword);
  if(suggested.indexOf(keyword)!=0) {
    setSuggested('');
    startIndex = 1;
    searchTotal = SEARCH_MAX;
  }
  
  if(!dragging) {
    searchControl(0);
  }
}

// 0 is a general modification
// ENTER is force search
// PGUP/PGDN page up / page down
function searchControl(action) {
  var keyword = $('#searchBox').val().ltrim();

  if(action == 0) {
    forceSearch = false;
    suggestEnabled = true;
  }
  else if(keyword != '') {
    if(action == ENTER) {
      forceSearch = true;
      suggestEnabled = false;
    }
    else if(action == PGUP) {
      var newIndex = startIndex;
      if(startIndex > searchTotal) {
        newIndex = Math.floor(searchTotal/perPage)*perPage + 1;
      }
      else {
        newIndex = startIndex - perPage;
        newIndex = Math.max(1, newIndex);
      }
      
      if(newIndex != startIndex) {
        forceSearch = true;
        startIndex = newIndex;
      }
    }
    else if(action == PGDN) {
      var newIndex = startIndex;
      if(startIndex + perPage <= searchTotal) {
        newIndex = startIndex + perPage;
      }
      else if(startIndex > searchTotal) {
        newIndex = Math.floor(searchTotal/perPage)*perPage + 1;
      }
      
      if(newIndex != startIndex) {
        forceSearch = true;
        startIndex = newIndex;
      }
    }
  }
  
  if(!throttle) {
    throttledSearch();
  }
}

function onSearchKeyDown(e) {
  if(e.keyCode == ENTER && !dragging) {
    setSuggested('');
    searchControl(ENTER);
  }

  var range = $('#searchBox').getSelection();
  var keyword = $('#searchBox').val();

  if(e.keyCode == RIGHT_ARROW) {
    if(keyword.length > 0 && suggested.length > 0) {
      if(range.start >= keyword.length) {
        $('#searchBox').val(suggested);
        $('#searchBox').setSelection(suggested.length, suggested.length);
        $('#searchText').html(suggested);
      }
    }
  }

  if (searchTrapKey(e.keyCode)) {
    e.stopPropagation();
  }
}

function onSearchFocus() {
  lastFocused = $('#searchBox');
  itemFocused = true;
}

function onSearchBlur() {
  itemFocused = false;
}

function onWindowFocus() {
  windowFocused = true;
}

function onWindowBlur() {
  windowFocused = false;
}

function perPageChanged(per) {
  if(per > videos.length) {
    searchControl(ENTER);
  }
  else {
    updateSearchResults(videos);
  }
}

function calculatePerPage() {
  var per = Math.floor(($('#searchCell').height() - $('#searchForm').height())/searchItemHeight+.3);
  per = Math.min(per, PERPAGE_MAX);
  per = Math.max(per, PERPAGE_MIN);
  
  if(perPage != per) {
    perPage = per;
    perPageChanged(per);
  }
}

function onWindowResize() {
  //var maxItems = Math.ceil($('#barCell').width()/queueItemWidth) + 5;
  //var resizeOn = Math.ceil($('#barCell').width()/queueItemWidth/2);
 
  calculatePerPage();
  
  if(aboutOpen) {
    keepInWindow($('#about'));
  }
  
  if(managerOpen) {
    keepInWindow($('#manager'));
  }
}

function onSuggestFocus() {
  lastFocused = $('#searchBox');
  itemFocused = false;
  $('#searchBox').focus();
  var keyword = $('#searchBox').val();
  $('#searchBox').setSelection(keyword.length, keyword.length);
}

function setSuggested(keyword) {
  suggested = keyword;
  $('#suggestBox').val(suggested);
}

function suggest(keyword) {
  var the_url='http://suggestqueries.google.com/complete/search?hl=en&ds=yt&json=t&q=' + encodeURIComponent(keyword);
  
  if(keyword.length > 0) {
    if(curRequest) {
      curRequest.abort();
    }
  
    //alert(the_url);
    curRequest = $.ajax({
      type: "GET",
      url: the_url,
      dataType: "jsonp",
      success: function(responseData, textStatus, XMLHttpRequest) {
        curRequest = null;
        var suggests = responseData[1];
        var trimmed = keyword.ltrim();
        if (suggests && suggests.length && suggests[0].indexOf(trimmed) == 0) {
          var start = keyword.indexOf(trimmed);
          newSuggested = keyword.substring(0, start) + suggests[0];
          if(newSuggested != suggested) {
            startIndex = 1;
            searchTotal = SEARCH_MAX;
            setSuggested(newSuggested);
          }
          search(suggested, startIndex, perPage);
        }
        else {
          startIndex = 1;
          searchTotal = SEARCH_MAX;
          setSuggested('');
          search(keyword, 1, perPage);
        }
      }
    });
  }
  else {
    startIndex = 1;
    searchTotal = SEARCH_MAX;
    setSuggested('');
    search('', 1, perPage);
  }
}

function search(keyword, start, max) {
  if(typeof start == 'undefined') {
    start = 1;
  }
  
  if(typeof max == 'undefined') {
    max = perPage || 5;
  }

  var time = keyword.match(/&t=(.+?)(?=&|$)/);
  offset = 0;
  if(time) {
    keyword = keyword.substring(0, time.index) + keyword.substring(time.index + time[0].length);
    
    offstr = time[1];
    
    var min = offstr.match(/(\d+)m/);
    if(min) {
      offset=parseInt(min[1])*60;
    }
    
    var sec = offstr.match(/(\d+)(s|(?![m\d]))/);
    if(sec) {
      offset+=parseInt(sec[1]);
    }
  }
  
  var the_url='http://gdata.youtube.com/feeds/api/videos?q='+encodeURIComponent(keyword)+'&format=5&v=2&alt=jsonc&start-index=' + start + '&max-results=' + max;
  
  if(keyword.length > 0) {
    if(curRequest) {
      curRequest.abort();
    }
  
    curRequest = $.ajax({
      type: "GET",
      url: the_url,
      dataType:"jsonp",
      success: function(responseData, textStatus, XMLHttpRequest) {
        curRequest = null;
        if (responseData.data.items) {
          videos = responseData.data.items;
          
          for(var i=0;i<videos.length;i++) {
            videos[i].offset = offset;
          }
        }
        else {
          videos = [];
        }
        
        searchTotal = Math.min(responseData.data.totalItems || SEARCH_MAX, SEARCH_MAX);
        if(!responseData.data.items && searchTotal > 1 && startIndex > 1) {
          if(startIndex > searchTotal) {
            startIndex = Math.floor(searchTotal/perPage)*perPage + 1;
          }
          else {
            startIndex -= perPage;
            startIndex = Math.max(1, startIndex);
          }
          search(keyword, startIndex, perPage);
        }
        updateSearchResults(videos);
      }
    });
  }
  else {
    videos = [];
    updateSearchResults(videos);
  }
}

function updateSearchResults(videos)
{
  var resultsWrapper = $('#resultsWrapper').empty();
  $('#searchTemplate').tmpl({results:videos,count:perPage}).appendTo(resultsWrapper);
  perDisplayed = Math.min(videos.length, perPage);
  $('#results > .searchItem').hover(onSearchItemMouseEnter, onSearchItemMouseLeave);
  $('#results > .searchItem').draggable({helper: createSearchDrag, appendTo: 'body', connectToSortable: '#queue,#managerQueue ul', zIndex: 5, start: onSearchDragStart, stop: onSearchDragStop, scroll: false});
}

function createSearchDrag(evt) {
  var id = $(this).attr('id');
  id = parseInt(id.substring(id.indexOf('-')+1));
  
  var div = $('<div/>').addClass('searchDrag');
  div.append($(this).find('.searchThumb').clone());
  
  return div;
}

function onSearchDragStart() {
  dragging = true;
  $("#queue").sortable("refresh");
  barMsgReset();
}

function onSearchDragStop() {
  dragging = false;
  barMsgReset();
  var keyword = $('#searchBox').val();
  if(oldSearch != keyword) {
    searchControl(0);
  }
}

function onQueueDrop(evt, ui) {
  var idStr = $(ui.draggable).attr('id');
  id = parseInt(idStr.substring(idStr.indexOf('-')+1));
  
  if(!isNaN(id)) {
    queueSearchVideo(id);
  }
}

function updateQueueDisplay()
{
  $('#queueCell').empty();
  $('#queueTemplate').tmpl({queue:queue}).appendTo($('#queueCell'));
  $('#queue').sortable({update: queueSort, floats: true});
  $('#queue > div').hover(onQueueItemMouseEnter, onQueueItemMouseLeave);
  $('#queueDrop').droppable({accept: '.searchItem', drop: onQueueDrop});

  sendQueue();
  updateManagerDisplay();
}

function sortReceive(evt, ui) {
}

function updateManagerDisplay()
{
  if(queue.length>0) {
    $('#managerFilter').show();
    
    var filter = $('#managerFilter').val().toLowerCase();
    var ul = $('<ul/>');
  
    for (var i=0; i < queue.length; i++) {   
      if(filter == '' || queue[i].title.toLowerCase().indexOf(filter) > -1) {
        $('#managerTemplate').tmpl({index:i,item:queue[i]}).appendTo(ul);
      }
    }
    
    $('#managerQueue').empty().append(ul);
    
    if(filter == '') {
      ul.sortable('enable');
      ul.sortable({update: queueSort, helper: 'clone'});
    }
  }
  else {
    $('#managerFilter').hide();
    
    $('#managerQueue').html('You have no items in the queue');
  }
  
  keepInWindow($('#manager'));
}

function queueSort() {
  var children = $(this).children();
  
  if(children.length > 0) {
    var order = [];
    
    for(var i=0;i<children.length;i++) {
      var idStr = $(children[i]).attr('id');
      id = parseInt(idStr.substring(idStr.indexOf('-')+1));
      
      if(!isNaN(id)) {
        if(idStr.indexOf('search') > -1) {
          id = id + 's';
        }
        order.push(id);
      }
    }
    
    queueReorder(order);
  }
}

function queueReorder(order) {
  var nqueue = [];
  var firstChange = false;
  
  for(var i=0;i<order.length;i++) {
    if(typeof order[i] == 'string') {
      var id = parseInt(order[i]);
      nqueue.push(videos[id]);
    }
    else {
      nqueue.push(queue[order[i]]);
    }
    
    if(i == 0 && order[i] != 0) {
      firstChange = true;
    }
  }
  
  queue = nqueue;
  
  if(firstChange) {
    setCurrentVideo(0);
  }
  updateQueueDisplay();
}

function watchSearchNow(i) {
  watchVideoNow(videos[i]);
}

function watchVideoNow(video) {
  queue.push(video);
  watchNow(queue.length-1);
  updateQueueDisplay();
}

function onSearchItemMouseEnter(e) {
  $(this).find('.watchnowLink,.enqueueImg').css('display', 'inline-block');
}

function onSearchItemMouseLeave(e) {
  $(this).find('.watchnowLink,.enqueueImg').hide();
}

function queueSearchVideo(i) {
  queueVideo(videos[i]);
}

function traverse(o,func) {
  for (i in o) {
    console.log(i + ': ' + o[i]);
    if (typeof(o[i])=="object") {
        traverse(o[i],func);
    }
  }
}

function queueVideos(recvVideos) {
  //traverse(recvVideos);
  var oldLen = queue.length;
  
  for(var i = 0; i < recvVideos.length; i++) {
    queue.push(recvVideos[i]);
  }
  
  // IE is retarded for some reason
  //queue.push.apply(queue, recvVideos);
  
  if(oldLen == 0) {
    setCurrentVideo(0);
  }
  updateQueueDisplay();
}

function queueVideo(video) {
  queue.push(video);
  updateQueueDisplay();
  
  if(queue.length <= 1) {
    setCurrentVideo(0);
  }
  else {
    barMsg(queue.length + '. ' + video.title);
  }
}

function setCurrentVideo(i) {
  if(i < queue.length) {
    if(i > 0) {
      var del = queue.remove(0, i);
      for(var i=0;i<del.length;i++) {
        previous.unshift(del[i]);
      }
      updateQueueDisplay();
    }
    
    loadNotifyVideo(queue[0]);
  }
  else {    
    // Put any videos onto the previous queue
    for(var i=0;i<queue.length;i++) {
      previous.unshift(queue[i]);
    }
    
    queue = [];
    nextPopular();
    updateQueueDisplay();
  }
}

// Should push to front... sending first video to previous if we have played enough of it
function watchNow(i) {
  if(i < queue.length) {
    if(i > 0) {
      var vid = queue.remove(i)[0];
      
      // Remove current video if past 30 secs/ 30% of video
      if(queue.length > 0) {
        secs = ytplayer.getCurrentTime();
        if(secs > 30 || secs > current.duration*.3){
          var first = queue.shift();
          previous.unshift(first);
        }
      }
      
      queue.unshift(vid);
      updateQueueDisplay();
    }
    
    setCurrentVideo(0);
  }
}

function onQueueItemMouseEnter(e) {
  $(this).find('.removeLink').css('display', 'inline-block');
}

function onQueueItemMouseLeave(e) {
  $(this).find('.removeLink').hide();
}

function queueRemove(i) {
  if(i < queue.length) {
    if(i == 0) {
      setCurrentVideo(1);
    }
    else {
      queue.remove(i);
      if(i <= 1) {
        barMsgReset();
      }
      updateQueueDisplay();
    }
  }
}

function loadNotifyVideo(video) {
  if(video.accessControl && video.accessControl.embed == 'allowed')
  {
    loadNotifyVideoById(video.id, video.title, video.offset);
    current = video;
    if(queue.length > 0)
      barMsgReset();
  }
  else {
    forceNextVideo();
  }
}

function loadNotifyVideoById(id, title, offset) {
  if(typeof offset == "undefined") {
    offset = 0;
  }
  
  try {
    ytplayer.loadVideoById(id, offset);
  }
  catch(err) {
    // In case it blows up, try again
    setTimeout(function(){loadNotifyVideoById(id, title, offset)},300);
    return;
  }

  var notify = $('#container');
  centerH(notify, $('#videoCell'));
  
  $("#container").notify("create", {
    text: title
  },
  {
    expires: 3000,
    click: function(e,instance){
      instance.close();
    }
  });
  
  document.title = '"' + title + '" on Youtube Karaoke'; 
}

function playVideo() {
  if(ytplayer) {
    ytplayer.playVideo();
  }
}

function pauseVideo() {
  if(ytplayer) {
    ytplayer.pauseVideo();
  }
}

function stopVideo() {
  if(ytplayer) {
    ytplayer.stopVideo();
  }
}

function clearVideo() {
  if(ytplayer) {
    ytplayer.clearVideo();
  }
}

function playPauseVideo() {
  if(ytplayer) {
    if(playerState == 1) {
      pauseVideo();
    }
    else if (playerState == 2 || playerState == -1) {
      playVideo();
    }
  }
}

// IE is retarded
if($.browser.msie)
  google.setOnLoadCallback(run);
else
  $(document).ready(run);
