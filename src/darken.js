// ==UserScript==
// @name         Darken
// @namespace    http://mehh.net/
// @version      0.1
// @description  Flip the colors of any website
// @issues       Flips background-images' colors, which isn't cool.
// @author       https://github.com/yzalium
// @run-at 		 document-idle
// @include      *://*wikipedia.org/*
// @include      *://*/wiki*
// @include      *://*atlassian.net/*
// @include      *://*developer.mozilla.org/*
// @include      *://mail.google.com/*
// @include      *://docs.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // add a new custom css rule to the document's head, to counter the global invert effect (we invert twice)
    var styleElement = document.createElement('style');
    document.head.appendChild(styleElement);
    styleElement.sheet.insertRule('.yzalium-invert { filter: invert(1); }');

    document.body.style.filter = 'invert(1)';
    getImages(document);

    /*
    // an attempt at catching future DOM updates to apply the anti-filter to async-added images, still in the works
    var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; ++i) {
            getImages(mutations[i].target);
        };
    });
    observer.observe(document.body, { childList: true, subtree: true });
    */

    function getImages(parent)
    {
        setTimeout(() => {
            var images = parent.querySelectorAll('img');
            for (var i = 0; i < images.length; ++i) {
                applyInvertClass(images[i]);
            }
        }, 200);
    }

    function applyInvertClass(elem)
    {
        if (/yzalium/.test(elem.className)) {
            return;
        }

        if (/img/i.test(elem.tagName)) {
            console.log(elem.src);
            elem.className += ' yzalium-invert';
            return;
        }
    }
})();
