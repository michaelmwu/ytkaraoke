// Key Constants
BACKSPACE = 8;
ENTER = 13;
PAUSE_BREAK = 19;
DEL = 46;
SPACEBAR = 32;
LEFT_ARROW = 37;
UP_ARROW = 38;
RIGHT_ARROW = 39;
DOWN_ARROW = 40;
ESC = 27;
CAPS = 20;
TAB = 9;
PGUP = 33;
PGDN = 34;
//Q_KEY = 81;
//S_KEY = 83;
Z_KEY = 90;
X_KEY = 88;
C_KEY = 67;
V_KEY = 86;
B_KEY = 66;
//H_KEY = 72;

SEARCH_THROTTLE_TIME = 200;

PERPAGE_MIN = 3;
PERPAGE_MAX = 10;

SEARCH_MAX = 1000;

var tokenError = false;
var queue = [];
var videos = [];

var perPage = PERPAGE_MIN;
var perDisplayed = 0;
var searchTotal = SEARCH_MAX;
var startIndex = 1;
var searchItemHeight = 105;

var oldSearch = '';
var oldFilter = '';
var throttle = false;
var filterThrottle = false;
var suggested = '';
var curRequest = null;

var lastFocused;
var windowFocused = true;
var itemFocused = false;
var token;
var leaving = false;

function notifyOpener() {
	if(self.opener && !self.opener.popupWin) self.opener.popupWin = self;
}

setInterval( notifyOpener, 200 );

function setHash(hash){
  hash = $.trim(hash);
  window.location.replace("#"+encodeURI(hash));
}

function sendQueue() {
	if(self.opener) {
		// The popup is open so call it
		self.opener.recvQueue(queue);
	}
}

function recvQueue(nqueue) {
	queue = nqueue;
  updateManagerDisplay();
}

function calculateDims() {
  searchItemHeight = $('#results .resultItem:first').outerHeight(true);
  
  calculatePerPage();
}

function run() {
  // String trim
  String.prototype.ltrim = function() {
    return this.replace(/^\s+/,"");
  }
  
  // Clear out the search box and focus
  var hash = $.param.fragment()
  var state = $.deparam.fragment(hash);
  
  var opts = {select: onTabSelect, cookie: {expires: 3600}};
  if(state.tab) {
    opts.selected = parseInt(state.tab);
  }
  $('#tabs').tabs(opts);
  
  if(hash.length > 0) {
    setHash('');
  }
  
  $('#shinedays').load(calculateDims);
  $('#shinedays').attr('src','shinedays.jpg');
  
  if(state.access_token && state.expires_in) {
    var token = state.access_token;
    var expires = parseInt(state.expires_in);
    
    if(token.length > 0 && !isNaN(expires)) {
      $.cookie("token-ytkaraoke", token, {expires: expires, path: '/'})
    }
  }
  else if(state.error) {
    tokenError = true;
  }
  
  updateLoginout();
  
  onTabSelectIndex($('#tabs').tabs("option", "selected"));
  
  $('#searchBox').val(state.q || '');
  $('#searchBox').focus(onSearchFocus);
  $('#searchBox').trigger('focus');
  $('#searchBox').blur(onSearchBlur);
  setAutoFocus($('#searchBox'));
  throttledSearch();
  
  $('#managerFilter').val('');
  $('#managerFilter').keyup(onFilterKeyUp);
  $('#managerFilter').focus(onFilterFocus);
  $('#managerFilter').blur(onFilterBlur);
  $('#managerFilter').keydown(onFilterKeyDown);
  
  $('#searchBox').keyup(onSearchKeyUp);
  $('#searchBox').input(onSearchInput);
  $('#searchBox').keydown(onSearchKeyDown);
  
  $('#suggestBox').focus(onSuggestFocus);
  $('#suggestBox').val('');
  
  $('#searchText').css('font-family', $('#searchBox').css('font-family'));
  $('#searchText').css('font-size', $('#searchBox').css('font-size'));
  
  $('#suggestText').css('font-family', $('#searchBox').css('font-family'));
  $('#suggestText').css('font-size', $('#searchBox').css('font-size'));
  
  // Prevent form submission
  $('#searchForm').submit(function(){return false});
  
  $('#playlistForm').submit(function(){getPlaylists();return false});
  
  setInterval(lastFocus, 300);
  
  $(window).blur(onWindowBlur);
  $(window).focus(onWindowFocus);
  $(window).resize(onWindowResize);
  
  $(document.documentElement).keydown(onKeyDown);
  $(document.documentElement).keyup(onKeyUp);
  $(window).unload( function(){if(!leaving && self.opener)self.opener.showSearch()} );
  
  $(document).mousewheel(onMouseWheel);
  
  if($.browser.msie) {
    $(window).error(function(){return true;});
  }
  
  if(self.opener)
    self.opener.sendQueue();
}

function onMouseWheel(e, d) {
  if(d > 0) {
    searchControl(PGUP);
  }
  else if(d < 0) {
    searchControl(PGDN);
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

function setAutoFocus(obj) {
  if(lastFocused != obj) {
    lastFocused = obj;
    itemFocused = false;
  }
}

function lastFocus() {
  if(windowFocused && lastFocused && !itemFocused) {
    lastFocused.focus();
    itemFocused = true;
  }
}

function updateLoginout() {
  if(!$.cookie("token-ytkaraoke") || tokenError) {
    $('#loginoutLink').attr('href', 'javascript:login()');
    $('#loginoutLink').text('Login');
  }
  else {
    $('#loginoutLink').attr('href', 'javascript:logout()');
    $('#loginoutLink').text('');
  }
}

function logout() {
  $.cookie("token-ytkaraoke", null, {path: '/'});
  if($('#tabs').tabs("option", "selected") == 2) {
    $('#tabs').tabs('select', '#tab-search');
  }
  updateLoginout();
}

function login(force) {
  if(!force) {
    token = $.cookie("token-ytkaraoke");
    
    if(token) {
      updateLoginout();
      return token;
    }
  }
  
  if(tokenError) {
    return false;
  }
  
  var myurl = window.location.protocol + '//' + window.location.hostname + window.location.pathname;
  var scope = 'http://gdata.youtube.com';
  
  var client_id = '322058828862.apps.googleusercontent.com';
  var url = 'https://accounts.google.com/o/oauth2/auth?client_id=' + client_id
    + '&redirect_uri=' + encodeURIComponent(myurl)
    + '&scope=' + encodeURIComponent(scope)
    + '&response_type=token'
    + '&state=tab=';
  
  leaving = true;
  
  $('#authForm').attr('action', url);
  $('#authForm').submit();
  
  $('#control').append('submitted!');
  
  return false;
}

var playlists = [];

function traverse(o,func) {
  for (i in o) {
    console.log(i + ': ' + o[i]);
    if (typeof(o[i])=="object") {
        traverse(o[i],func);
    }
  }
}

function queueVideos(playlist, title) {
  if(self.opener) {
    var playlistVideos = [];
    
    for(var i = 0; i < playlist.length; i++) {
      var video = playlist[i].video;
      playlistVideos.push(video);
    }
    
    self.opener.queueVideos(playlistVideos);
    self.opener.barMsg('Queued playlist: ' + title);
  }
}

function queuePlaylist(i) {
  getPlaylist(playlists[i].id, function(playlistVideos){queueVideos(playlistVideos, playlists[i].title)});
}

function getPlaylist(id, callback) {
  if(login()) {
    var the_url = 'http://gdata.youtube.com/feeds/api/playlists/' + id + '?v=2&format=5&alt=jsonc&oauth_token=' + token;
    
    $.ajax({
      type: "GET",
      url: the_url,
      dataType: "jsonp",
      success: function(responseData, textStatus, XMLHttpRequest) {
        if(responseData.data.items) {
          if(typeof callback == 'function')
            callback(responseData.data.items);
        }
      },
      error: function(XMLHttpRequest, textStatus, error) {
        login(true);
      }
    });
  }
}

function getPlaylists() {
  if(login()) {
    var the_url = 'http://gdata.youtube.com/feeds/api/users/default/playlists?v=2&alt=jsonc&oauth_token=' + token;
    
    $.ajax({
      type: "GET",
      url: the_url,
      dataType: "jsonp",
      success: function(responseData, textStatus, XMLHttpRequest) {
        $('#control').append('got');
        if(responseData.data.items) {
          playlists = responseData.data.items;
        }
        else {
          playlists = [];
        }
        
        var playlistResults = $('#playlistResults').empty();
        $('#playlistsTemplate').tmpl({playlists:playlists}).appendTo(playlistResults);
      },
      error: function(XMLHttpRequest, textStatus, error) {
        $('#control').append('error: ' + textStatus);
        login(true);
      }
    });
  }
  else {
    $('#control').append('empty');
    playlists = [];
    var playlistResults = $('#playlistResults').empty();
    $('#playlistsTemplate').tmpl({playlists:playlists}).appendTo(playlistResults);
  }
}

function onTabSelect(evt, ui) {
  onTabSelectIndex(ui.index);
}

function onTabSelectIndex(i) {
  if(i == 0) {
    setAutoFocus($('#searchBox'));
  }
  else if(i == 1) {
    setAutoFocus($('#managerFilter'));
  }
  else if(i == 2) {
    getPlaylists();
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
  var per = Math.floor(($('#tab-search').height() - $('#searchForm').height())/searchItemHeight + 0.3);
  per = Math.min(per, PERPAGE_MAX);
  per = Math.max(per, PERPAGE_MIN);
  
  if(perPage != per) {
    perPage = per;
    perPageChanged(per);
  }
}

function onWindowResize() {
  calculatePerPage();
}

function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

// Document key handling
function onKeyDown(e){
  var altCtrl = $.client.os == 'Mac' ? e.ctrlKey : e.altKey;
  
  if (altCtrl && (e.keyCode == V_KEY || e.keyCode == RIGHT_ARROW)) {
    nextVideo();
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
  else if(e.keyCode == PGUP || e.keyCode == PGDN) {
    searchControl(e.keyCode);
    return false;
  }
  
  return e.keyCode != BACKSPACE;
}

function onKeyUp(e){
  return e.keyCode != BACKSPACE;
}

// Key events not to propagate up from the search bar
function searchTrapKey(keyCode) {
  return keyCode == BACKSPACE || keyCode == PGUP || keyCode == PGDN;
}

function onSuggestFocus() {
  lastFocused = $('#searchBox');
  $('#searchBox').trigger('focus');
  var keyword = $('#searchBox').val();
  $('#searchBox').setSelection(keyword.length, keyword.length);
}

function setSuggested(keyword) {
  suggested = keyword;
  $('#suggestBox').val(suggested);
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

  searchControl(0);
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
  if(e.keyCode == ENTER) {
    setSuggested('');
    searchControl(ENTER);
  }
  else if(e.keyCode == PGUP || e.keyCode == PGDN) {
    searchControl(e.keyCode);
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

function isCharKeyPress(evt) {
    if (typeof evt.which == "undefined") {
        // This is IE, which only fires keypress events for printable keys
        return true;
    } else if (typeof evt.which == "number" && evt.which > 0) {
        // In other browsers except old versions of WebKit, evt.which is
        // only greater than zero if the keypress is a printable key.
        // We need to filter out backspace and ctrl/alt/meta key combinations
        if(evt.ctrlKey || evt.metaKey || evt.altKey)
          return false;
        return evt.keyCode != ENTER;
    }
    return false;
}

function onSearchKeyPress(e) {
  var range = $('#searchBox').getSelection();
  var keyword = $('#searchBox').val();
  
  if(range.start < keyword.length && isCharKeyPress(e)) {
    setSuggested('');
  }
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

function updateSearchResults()
{
  var resultsWrapper = $('#resultsWrapper').empty();
  $('#searchTemplate').tmpl({results:videos,count:perPage}).appendTo(resultsWrapper);
  perDisplayed = Math.min(videos.length, perPage);
  $('#results > .resultItem').hover(onSearchItemMouseEnter, onSearchItemMouseLeave);
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
}

function queueSort() {
  var children = $(this).children();
  
  if(children.length > 0) {
    var order = [];
    
    for(var i=0;i<children.length;i++) {
      var id = $(children[i]).attr('id');
      id = parseInt(id.substring(id.indexOf('-')+1));
      order.push(id);
    }
    
    if(self.opener) {
      self.opener.queueReorder(order);
      updateManagerDisplay();
    }
  }
}

function onPlayerStateChange(state) {  
  if(state == 1 || state == 3) {
    $('#controlPlayPause').attr('src', 'pause-22.png');
  }
  else if(state != -1) {
    $('#controlPlayPause').attr('src', 'play-22.png');
  }
}

function onSearchItemMouseEnter(e) {
  $(this).find('.watchnowLink,.enqueueImg').css('display', 'inline-block');
}

function onSearchItemMouseLeave(e) {
  $(this).find('.watchnowLink,.enqueueImg').hide();
}

function queueRemove(i) {
  if(self.opener)
    self.opener.queueRemove(i);
}

function watchSearchNow(i) {
  watchVideoNow(videos[i]);
}

function watchVideoNow(video) {
  if(self.opener) {
    self.opener.watchVideoNow(video);
  }
}

function watchNow(i) {
  if(self.opener)
    self.opener.watchNow(i);
}

function queueSearchVideo(i) {
  if(self.opener) {
    self.opener.queueVideo(videos[i]);
  }
}

function nextVideo() {
  if(self.opener)
    self.opener.forceNextVideo();
}

function prevVideo() {
  if(self.opener)
    self.opener.prevVideo();
}

function playVideo() {
  if(self.opener)
    self.opener.playVideo();
}

function pauseVideo() {
  if(self.opener)
    self.opener.pauseVideo();
}

function stopVideo() {
  if(self.opener)
    self.opener.stopVideo();
}

function playPauseVideo() {
  if(self.opener)
    self.opener.playPauseVideo();
}

function addCommas(nStr)
{
  nStr += '';
  x = nStr.split('.');
  x1 = x[0];
  x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }
  return x1 + x2;
}

String.prototype.truncate = function(len, trunc){
  if(typeof trunc == "undefined") {
    trunc = '&hellip;';
  }
  var re = new RegExp('^.{0,' + len + '}[\S]*');
  var m = re.exec(this);
  var l = m[0].length;
  m = m[0].replace(/\s$/,'');
  if(l < this.length)
    m = m + trunc;
  return m;
}

String.prototype.encodeHTML = function() {
  // Do HTML encoding replacing < > & and ' and " by corresponding entities.
  return this.split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
}

// IE is retarded
if($.browser.msie)
  google.setOnLoadCallback(run);
else
  $(document).ready(run);