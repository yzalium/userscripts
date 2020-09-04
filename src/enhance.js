// ==UserScript==
// @name         Enhance
// @namespace    http://mehh.net/
// @version      0.1
// @description  ENHANCE!
// @author       Me
// @run-at 		 document-idle
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	var bubble, loadingElem, helper,
        xhr = null,
		showing = false,
		mouseIsOnLeftHalf = false,
		mouseIsOnTopHalf = false,
		scrollbarWidth = 0,
		mouseX = 0,
		mouseY = 0,
        displayedWidth = 0,
        displayedHeight = 0,
        needsVideo = false,
        corsProxy = 'https://cors-anywhere.herokuapp.com/';
	init();

	function init()
	{
		measureScrollbarWidth();

		helper = document.createElement('div');
		helper.style.position = 'fixed';
		helper.style.zIndex = '10000';
		helper.style.display = 'none';
		helper.style.padding = '5px 8px';
		helper.style.borderRadius = '4px';
		helper.style.backgroundColor = '#2B2B2B';
		helper.style.color = '#EFEFEF';
		helper.style.fontSize = '12px';
		helper.style.fontWeight = 'bold';
		helper.style.maxWidth = '250px';
		helper.style.overflowWrap = 'break-word';
		helper.style.pointerEvents = 'none';
		helper.innerHTML = '&nbsp;';
		helper.id = 'link_target_helper';
		document.body.appendChild(helper);

        bubble = bubbleFactory('img');

		// gotta overwrite the send() function of AJAX requests to apply our special rules
		var _send = XMLHttpRequest.prototype.send;
		XMLHttpRequest.prototype.send = function()
		{
			// Wrap onreadystaechange callback
			var callback = this.onreadystatechange;
			if (!callback || /https:\/\/cors-anywhere\.herokuapp\.com\//i.test(this.responseUrl)) {
				return _send.apply(this, arguments);
            }

			this.onreadystatechange = function()
			{
				callback.apply(this, arguments);
				if (this && this.readyState == 4) { // this becomes null upon request cancellation
					analyzePage();
                }
			}
			_send.apply(this, arguments);
		}

        analyzePage();
	}

	function analyzePage()
	{
		var i = 0,
			toEnhance = [],
			toDetail = [],
			toImgur = [],
			toTwitter = [];

		var links = document.getElementsByTagName('a');
		linkList: for (; i < links.length; ++i) {
			var link = links[i];
			if (!link.href) {
				continue;
            }

			if (!/\.(?:jpg|jpeg|png|gif)(?:\/?\?.*)*$/i.test(link.href)) {
				try {
					var imgDomain = link.href.match(/\/\/([a-zA-Z0-9.]+)/i)[1];
					if (imgDomain == window.location.hostname) {
						continue;
                    }

					if (/imgur\.com$/i.test(imgDomain)) {
						toImgur.push(link);
                    }
					else if (/twitter\.com$/i.test(imgDomain)) {
						toTwitter.push(link);
                    }
                    else {
						toDetail.push(link);
                    }
				} catch (e) {}

				continue;
			}

			// if the link has the image it's pointing to in its children, there is no need to handle it
			if (link.children.length) {
				for (var j = 0; j < link.children.length; ++j) {
					if (link.children[j].src && link.children[j].src == link.href) {
						continue linkList;
                    }
                }
            }

			toEnhance.push(link);
		}
		links = null;

		var imgs = document.getElementsByTagName('img');
		for (i = 0; i < imgs.length; ++i) {
			var img = imgs[i];
			if (!img.src) {
				continue;
            }

			if (img.naturalWidth > img.width * 1.5) { // if the img is reduced by less than a ratio of 1.5, we skip it
				toEnhance.push(img);
            }
		}
		imgs = null;

		for (i in toEnhance) {
			toEnhance[i].removeEventListener('mouseover', enhance, false);
			toEnhance[i].removeEventListener('mouseout', blur, false);
			toEnhance[i].addEventListener('mouseover', enhance, false);
			toEnhance[i].addEventListener('mouseout', blur, false);
		}

		for (i in toDetail) {
			toDetail[i].removeEventListener('mouseover', detail, false);
			toDetail[i].removeEventListener('mouseout', blur, false);
			toDetail[i].addEventListener('mouseover', detail, false);
			toDetail[i].addEventListener('mouseout', blur, false);
		}

		for (i in toImgur) {
			toImgur[i].removeEventListener('mouseover', imgurScrape, false);
			toImgur[i].removeEventListener('mouseout', blur, false);
			toImgur[i].addEventListener('mouseover', imgurScrape, false);
			toImgur[i].addEventListener('mouseout', blur, false);
		}

		for (i in toTwitter)
		{
			toTwitter[i].removeEventListener('mouseover', twitterScrape, false);
			toTwitter[i].removeEventListener('mouseout', blur, false);
			toTwitter[i].addEventListener('mouseover', twitterScrape, false);
			toTwitter[i].addEventListener('mouseout', blur, false);
		}
	}

	function loadStarted(mouseEvent)
	{
        var pageWidth = window.innerWidth - scrollbarWidth,
			pageHeight = window.innerHeight;

		showing = true;
		mouseX = mouseEvent.clientX;
		mouseY = mouseEvent.clientY;
		loadingElem = mouseEvent.currentTarget;
		loadingElem.style.cursor = 'wait';
		mouseIsOnLeftHalf = mouseX / pageWidth < .5;
		mouseIsOnTopHalf = mouseY / pageHeight < .5;
	}

    // TODO this doesn't do anything - load errors are never caught
    var bubbleLoadError = function(e)
    {
        bubble.removeEventListener('error', bubbleLoadError, false);

        if (!bubble.src || !/imgur\.com/.test(bubble.src)) {
            return;
        }

        var url = bubble.src.split('.');
        url.pop();
        url.push('png');
        bubble.src = url.join('.');
    }

	function bubbleLoaded()
	{
		if (!showing) {
			return;
        }

        if (xhr) {
			xhr = null;
		}
		else {
			setTimeout(function() {
				helper.style.display = 'none';
			}, 500);
		};

        bubble.removeEventListener('error', bubbleLoadError, false);

		var imgWidth = bubble.naturalWidth,
			imgHeight = bubble.naturalHeight,
			pageWidth = window.innerWidth - scrollbarWidth,
			pageHeight = window.innerHeight,
			ratio = imgWidth / imgHeight,
			isVertical = ratio <= 1,
			availableWidth = (isVertical ? (mouseIsOnLeftHalf ? pageWidth - mouseX : mouseX) : pageWidth) - 10,
			availableHeight = (isVertical ? pageHeight : (mouseIsOnTopHalf ? pageHeight - mouseY : mouseY)) - 10;

		if (availableWidth > imgWidth) {
			availableWidth = imgWidth;
        }

		if (availableHeight > imgHeight) {
			availableHeight = imgHeight;
        }

		var promisedHeight = availableWidth / ratio,
			halfPromisedHeight = promisedHeight / 2;

		// figuring out positioning
		if (mouseIsOnLeftHalf) {
			bubble.style.left = (isVertical ? mouseX + 5 : 5) + 'px';
        }
		else {
			bubble.style.right = (isVertical ? pageWidth - mouseX - 5 : 5) + 'px';
        }

		if (mouseIsOnTopHalf && isVertical) {
			bubble.style.top = (halfPromisedHeight > mouseY ? 5 : mouseY - halfPromisedHeight) + 'px';
        }
		else if (mouseIsOnTopHalf) {
			bubble.style.top = (mouseY + 5) + 'px';
        }
		else if (!isVertical) {
			bubble.style.bottom = (pageHeight - mouseY + 5) + 'px';
        }
		else {
			bubble.style.bottom = (halfPromisedHeight > pageHeight - mouseY ? 5 : pageHeight - (mouseY + halfPromisedHeight)) + 'px';
        }

		// figuring out bubble size
		if (availableWidth > imgWidth && availableHeight > imgHeight) {// plenty of space to draw
			bubble.width = imgWidth;
        }
		else if (availableWidth > imgWidth && availableHeight < imgHeight) { // height is lacking
			bubble.height = availableHeight;
        }
		else if (availableWidth < imgWidth && availableHeight > imgHeight) { // width is lacking
			bubble.width = availableWidth;
        }

		else // both directions are lacking
		{
			if (isVertical) {
				bubble.height = availableHeight;
            }
			else {
                var tmp = availableHeight * ratio;
				bubble.width = availableWidth > tmp ? tmp : availableWidth;
            }
		}

		loadingElem.style.cursor = '';

		// currently displayed picture is bigger: abort
		if (displayedWidth >= bubble.width || displayedHeight >= bubble.height) {
			return blur();
        }

		bubble.style.display = 'block';
	}

	var imgurScrape = function(event)
	{
		if (showing) {
			return;
        }

		if (xhr) {
			xhr = null;
        }

		loadStarted(event);

        // imgur.com/gallery/[id] and imgur.com/a/[id] urls cannot be parsed anymore :(
        if (/imgur\.com\/(?:\w+)\/\w+/.test(event.currentTarget.href)) {
            return blur();
        }
        // imgur.com/[id] can be transformed into i.imgur.com/[id].jpg
        else if (/:\/\/imgur\.com\/(?:\w{4,})$/.test(event.currentTarget.href)) {
            bubble.src = event.currentTarget.href.replace('imgur', 'i.imgur') + '.jpg';
            return;
        }

        // call the full imgur page, and parse it to get the actual image url
		xhrFactory('GET', event.currentTarget.href, function() {
            bubble.addEventListener('error', bubbleLoadError, false);
            console.log(xhr.responseText);
			var match = (xhr.responseText.match(/post-image-container[^<>]*(?:id="([a-z0-9/._-]+)")/i)
				|| xhr.responseText.match(/(?:id="([a-z0-9/._-]+)")[^<>]*post-image-container/i));

            if (match) {
                bubble.src = 'https://i.imgur.com/'+ match[1] +'.jpg';
            }
		});
	}

	var twitterScrape = function(event)
	{
		if (showing) {
			return;
        }

		if (xhr) {
			xhr = null;
        }

		loadStarted(event);

		xhrFactory('GET', event.currentTarget.href, function() {
			// call the full twitter page, and parse it to get the actual image url
			bubble.src = xhr.responseText.match(/"(https:\/\/pbs\.twimg\.com\/media\/[a-z0-9_.-]+)/i)[1];
		});
	}

	function enhance(event)
	{
		if (showing) {
			return;
        }

		var	isImage = 'undefined' != typeof event.currentTarget.naturalWidth;

		loadStarted(event);

		if (isImage) {
			displayedWidth = event.currentTarget.width;
			displayedHeight = event.currentTarget.height;
		}
		else {
            // fake a click event to display details helper
            xhrFactory('HEAD', event.currentTarget.href, function() {
                detail({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    currentTarget: {
                        href: 'File size : '+ (xhr.getResponseHeader('Content-Length') / 1000) +'kb'
                    }
                });
            });
        }

		bubble.src = isImage ? event.currentTarget.src : event.currentTarget.href;

        // TODO this doesn't work
        if (/\.gif(?:\/?\?.*)*$/i.test(bubble.src)) {
            setTimeout(bubbleLoaded, 2000);
        }
	}

	function blur()
	{
		showing = false;
		mouseIsOnLeftHalf = false;
		mouseIsOnTopHalf = false;
		mouseX = 0;
		mouseY = 0;
        helper.style.display = 'none';

		if (loadingElem) {
            displayedWidth = 0;
            displayedHeight = 0;
            bubble.src = '';
            bubble.removeAttribute('width');
            bubble.removeAttribute('height');
            bubble.style.top = '';
            bubble.style.bottom = '';
            bubble.style.left = '';
            bubble.style.right = '';
            bubble.style.display = 'none';
			loadingElem.style.cursor = '';
			loadingElem = null;
		}
	}

	function detail(event)
	{
        if (xhr) {
			xhr = null;
		}

        var top;
        helper.style.display = 'block';
		helper.style.top = top = (event.clientY + 15) + 'px';
		helper.style.left = (event.clientX + 250 > window.innerWidth ? event.clientX - 260 : event.clientX) + 'px';
		helper.innerHTML = event.currentTarget.href;

		setTimeout(function() {
			if (top == helper.style.top) {
				helper.style.display = 'none';
            }
		}, 5000);
	}

	function measureScrollbarWidth()
	{
		var outer = document.createElement("div");
		outer.style.visibility = "hidden";
		outer.style.width = "100px";
		outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps
		document.body.appendChild(outer);

		var widthNoScroll = outer.offsetWidth;
		outer.style.overflow = "scroll";

		// add inner div
		var inner = document.createElement("div");
		inner.style.width = "100%";
		outer.appendChild(inner);

		scrollbarWidth = widthNoScroll - inner.offsetWidth;
		outer.parentNode.removeChild(outer);
	}

    function bubbleFactory(type)
    {
        var ref = document.createElement(type);
		ref.style.borderRadius = '5px';
		ref.style.position = 'fixed';
		ref.style.zIndex = '100000';
		ref.style.display = 'none';
		ref.style.pointerEvents = 'none';

        /*
        if ('video' == type) {
            ref.setAttribute('mute', true);
            ref.setAttribute('autoplay', true);
            ref.setAttribute('loop', true);
            ref.setAttribute('playsinline', true);
            ref.setAttribute('preload', 'auto');
            ref.addEventListener('canplay', bubbleLoaded, false);
        }
        else {
        */
            ref.addEventListener('load', bubbleLoaded, false);
        /*}*/

		document.body.appendChild(ref);

        return ref;
    }

	function xhrFactory(method, url, successCallback)
	{
		xhr = new XMLHttpRequest();
		xhr.open(method, corsProxy + url, true);
		xhr.onreadystatechange = function() {
			if (xhr && xhr.readyState == 4 && xhr.status == 200) { // xhr can be null if cancelled
				successCallback();
            }
		};
		xhr.send();
	}
})();
