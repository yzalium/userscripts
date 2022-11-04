// ==UserScript==
// @name         Darken
// @namespace    http://any.org/
// @version      2
// @description  A div darkener utility, enabling you to highlight-on-hover sections of visited html pages, and darken on the fly. Changed sections will be saved, and changed again at your next visit. Config is saved by domain.
// @author       https://github.com/yzalium
// @run-at 	 document-idle
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  const pageKey =
      /[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{2,4}$/i.test(window.location.hostname)
        ? 'swapped_' +
          window.location.hostname.match(
            /[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{2,4}$/i,
          )[0]
        : 'empty',
    version = 2,
    shortCut1 = 'Shift',
    shortCut2 = 'Meta',
    darkenedCol = '#9a9a9a';

  let hovering = null,
    firstKey = '',
    toggle = false,
    lastAction = null,
    helper,
    abort,
    swappedData;

  init();

  function init() {
    const defaultSetup = { version: version, ids: {}, classes: {} };
    try {
      swappedData = JSON.parse(GM_getValue(pageKey)) || defaultSetup;
    } catch (e) {
      swappedData = defaultSetup;
    }

    // data wipe if needed
    // resetForCurrentDomain();

    // manual remove if needed
    // addBannedValue('thevalue', 'classes'/*'ids'*/);

    helper = document.createElement('div');
    helper.style.position = 'fixed';
    helper.style.zIndex = '10000';
    helper.style.display = 'none';
    helper.style.padding = '5px 8px';
    helper.style.borderRadius = '4px';
    helper.style.backgroundColor = '#2B2B2B';
    helper.style.fontSize = '12px';
    helper.style.fontWeight = 'bold';
    helper.style.maxWidth = '150px';
    helper.style.overflowWrap = 'break-word';
    helper.style.pointerEvents = 'none';
    helper.innerHTML = '&nbsp;';
    helper.id = 'page_swapper_target_helper';
    document.body.appendChild(helper);

    abort = document.createElement('div');
    abort.style.position = 'fixed';
    abort.style.zIndex = '10005';
    abort.style.display = 'none';
    abort.style.padding = '5px 8px';
    abort.style.borderRadius = '4px';
    abort.style.backgroundColor = '#2B2B2B';
    abort.style.color = '#E5C66D';
    abort.style.fontSize = '24px';
    abort.style.fontWeight = 'bold';
    abort.style.cursor = 'pointer';
    abort.innerHTML = 'ABORT';
    abort.id = 'page_swapper_abort';
    abort.addEventListener('click', revertLastSave, false);
    document.body.appendChild(abort);

    window.addEventListener('keydown', toggleOn, false);
    window.addEventListener('keyup', toggleOff, false);

    // gotta overwrite the send function of AJAX requests to apply our special rules
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      // Wrap onreadystaechange callback
      const callback = this.onreadystatechange;
      if (!callback) {
        return _send.apply(this, arguments);
      }

      this.onreadystatechange = function () {
        callback.apply(this, arguments);
        if (this && this.readyState == 4) {
          applyData();
        }
      };
      _send.apply(this, arguments);
    };

    applyData();
  }

  function applyData() {
    for (const id in swappedData.ids) {
      let item;
      if ((item = document.getElementById(id))) {
        cssUpdate(item);
      }
    }

    for (const className in swappedData.classes) {
      const items = document.getElementsByClassName(className);

      for (let i = 0; i < items.length; ++i) {
        cssUpdate(items[i]);
      }
    }
  }

  function toggleOn(event) {
    if (
      (firstKey == shortCut1 && event.key == shortCut2) ||
      (firstKey == shortCut2 && event.key == shortCut1)
    ) {
      toggle = true;
      window.addEventListener('mousemove', globalMouseMove, false);
    }

    firstKey = event.key;
  }

  function toggleOff(event) {
    if (!toggle || (event.key != 'Ctrl' && event.key != 'Shift')) {
      return;
    }

    firstKey = '';
    toggle = false;
    window.removeEventListener('mousemove', globalMouseMove, false);
    blur(hovering);
  }

  function blur(element) {
    if (!element || 'page_swapper_abort' == element.id) {
      return;
    }

    element.style.background = '';
    element.removeEventListener('click', swapElem, false);
    helper.style.display = 'none';
    hovering = null;
  }

  function focus(event) {
    if ('page_swapper_abort' == event.target.id) {
      return;
    }

    event.target.style.background = 'rgba(73, 230, 59, .7)';
    event.target.addEventListener('click', swapElem, false);

    if (!event.target.id && !event.target.className) {
      return;
    }

    helper.style.display = 'block';
    helper.style.top = (event.clientY + 15) + 'px';
    helper.style.left =
      (event.clientX + 150 > window.innerWidth
        ? event.clientX - 160
        : event.clientX) + 'px';
    helper.innerHTML = '<span style="color:#A886BA">' +
      event.target.tagName.toLowerCase() + '</span><span style="color:' +
      (event.target.id
        ? '#FFC66D">#' + event.target.id
        : '#88B7C5">.' + event.target.className) +
      '</span>';
  }

  function addSwappedValue(val, type) {
    if ('undefined' != typeof swappedData[type][val]) {
      return;
    }

    lastAction = { type: type, val: val };
    swappedData[type][val] = 'none';
    save();
  }

  function revertLastSave() {
    hideAbort();

    if (!lastAction) {
      return;
    }

    delete swappedData[lastAction.type][lastAction.val];
    cssRevert(lastAction);
    lastAction = null;
    save();
  }

  function save() {
    GM_setValue(pageKey, JSON.stringify(swappedData));
  }

  function cssUpdate(element) {
    element.style.setProperty('background-color', darkenedCol, 'important');
    // element.style.setProperty('color', '#e3e3de', 'important');
  }

  function cssRevert(info) {
    if ('ids' == info.type) {
      document.getElementById(info.val).style.backgroundColor = '';
      document.getElementById(info.val).style.color = '';
      return;
    }

    const items = document.getElementsByClassName(info.val);
    for (let i = 0; i < items.length; ++i) {
      items[i].style.backgroundColor = '';
      items[i].style.color = '';
    }
  }

  function showAbort(event) {
    abort.style.display = 'block';
    abort.style.top = (event.clientY - 15) + 'px';
    abort.style.left =
      (event.clientX + 150 > window.innerWidth
        ? event.clientX - 160
        : event.clientX) + 'px';
    setTimeout(hideAbort, 7000);
  }

  function hideAbort() {
    abort.style.display = 'none';
  }

  const globalMouseMove = function (event) {
    if (event.target == hovering) {
      return;
    }

    blur(hovering);
    hovering = event.target;
    focus(event);
  };

  const swapElem = function (event) {
    event.preventDefault();
    blur(event.target);

    if (
      'body' == document.body.tagName.toLowerCase() &&
      document.getElementsByTagName('div')[0].ownerDocument.defaultView ===
        window.top
    ) {
      return;
    }

    const className = event.target.className,
      id = event.target.id,
      classUsers = document.getElementsByClassName(className),
      classUsersCount = classUsers.length,
      canSaveForFurtherPageLoads = (id || classUsersCount == 1),
      hasTooManyClasses = !id && classUsersCount > 1;

    if (canSaveForFurtherPageLoads) {
      cssUpdate(event.target);
      addSwappedValue(id || className, id ? 'ids' : 'classes');
      showAbort(event);
    } else if (hasTooManyClasses) {
      for (let i = 0; i < classUsersCount; ++i) {
        classUsers[i].style.background = 'rgba(162, 198, 75, .7)';
      }

      setTimeout(function () {
        delayedDeleteByClass(event, classUsers, className);
      }, 100);
    }
  };

  function delayedDeleteByClass(event, classUsers, className) {
    let i = 0,
      classUsersCount = classUsers.length,
      canSaveForFurtherPageLoads = confirm(
        'This item can only be identified by its class and has ' +
          classUsersCount +
          ' siblings (shown in green), do you want to save this setting anyway?',
      );

    for (; i < classUsersCount; ++i) {
      classUsers[i].style.background = '';
    }

    toggleOff({ key: shortCut1 }); // simulating a keyup event

    if (canSaveForFurtherPageLoads) {
      for (i = 0; i < classUsersCount; ++i) {
        cssUpdate(classUsers[i]);
      }

      addSwappedValue(className, 'classes');
      showAbort(event);
    }
  }

  function resetForCurrentDomain() {
    swappedData = { version: 2, ids: {}, classes: {}, actions: {} };
    save();
  }
})();
