// ==UserScript==
// @name         CleanPage
// @namespace    http://any.org/
// @version      3
// @description  A page cleaner utility, enabling you to highlight-on-hover sections of visited html pages, and delete them on the fly. Deleted sections will be saved as unwanted, and hidden again at your next visit. Config is saved by domain.
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
        ? 'banned_' +
          window.location.hostname.match(
            /[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{2,4}$/i,
          )[0]
        : 'empty',
    version = 3,
    shortCut1 = 'Shift',
    shortCut2 = 'Alt';

  let hovering = null,
    firstKey = '',
    toggle = false,
    lastAction = null,
    observing = false,
    observer,
    helper,
    abort,
    bannedData;

  init();

  function init() {
    const defaultSetup = {
      version: version,
      ids: {},
      classes: {},
      actions: {},
      monitorMutations: false,
    };
    try {
      bannedData = JSON.parse(GM_getValue(pageKey)) || defaultSetup;
    } catch (e) {
      bannedData = defaultSetup;
    }

    if (!bannedData.version || bannedData.version != version) {
      updateData();
    }

    // data wipe if needed
    // resetForCurrentDomain();
    // emptySpecialActionsForCurrentDomain();

    // set mutations manually
    // bannedData.monitorMutations = true;
    // save();

    // manual remove if needed
    // addBannedValue('thevalue', 'classes'/*'ids'*/);

    // manual extra rules registerer
    // addSpecialAction('css::body', 'overflow', 'auto !important');
    // addSpecialAction('css::.qc-cmp-ui-container', 'display', 'none !important');
    // addSpecialAction('css::.qc-cmp2-ui', 'display', 'none !important');

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
    helper.id = 'page_cleaner_target_helper';
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
    abort.id = 'page_cleaner_abort';
    abort.addEventListener('click', revertLastSave, false);
    document.body.appendChild(abort);

    window.addEventListener('keydown', toggleOn, false);
    window.addEventListener('keyup', toggleOff, false);

    if (bannedData.monitorMutations) {
      setTimeout(function () {
        document.addEventListener('dblclick', initObserver, false);
      }, 1000);
    }

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
    for (const id in bannedData.ids) {
      let item;
      if ((item = document.getElementById(id))) {
        cssUpdate(item, bannedData.ids[id]);
      }
    }

    for (const className in bannedData.classes) {
      const items = document.getElementsByClassName(className),
        value = bannedData.classes[className];

      for (let i = 0; i < items.length; ++i) {
        cssUpdate(items[i], value);
      }
    }

    // a little delay, to avoid lagging out the page while it's loading up its fuckton of plugins
    setTimeout(function () {
      for (const target in bannedData.actions) {
        const action = bannedData.actions[target];
        applySpecialAction(target, action.property, action.value);
      }
    }, 2000);
  }

  function toggleOn(event) {
    if (
      (firstKey == shortCut1 && event.key == shortCut2) ||
      (firstKey == shortCut2 && event.key == shortCut1)
    ) {
      toggle = true;
      toggleObserver();
      window.addEventListener('mousemove', globalMouseMove, false);
    }

    firstKey = event.key;
  }

  function toggleOff(event) {
    if (!toggle || (event.key != shortCut1 && event.key != shortCut2)) {
      return;
    }

    firstKey = '';
    toggle = false;
    toggleObserver();
    window.removeEventListener('mousemove', globalMouseMove, false);
    blur(hovering);
  }

  function blur(element) {
    if (!element || 'page_cleaner_abort' == element.id) {
      return;
    }

    element.style.background = '';
    element.removeEventListener('click', deleteElem, false);
    helper.style.display = 'none';
    hovering = null;
  }

  function focus(event) {
    if ('page_cleaner_abort' == event.target.id) {
      return;
    }

    event.target.style.background = 'rgba(230, 73, 59, .7)';
    event.target.addEventListener('click', deleteElem, false);

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

  function addBannedValue(val, type) {
    if ('undefined' != typeof bannedData[type][val]) {
      return;
    }

    lastAction = { type: type, val: val };
    bannedData[type][val] = 'none';
    save();
  }

  function revertLastSave() {
    hideAbort();

    if (!lastAction) {
      return;
    }

    delete bannedData[lastAction.type][lastAction.val];
    displayItem(lastAction);
    lastAction = null;
    save();
  }

  function save() {
    GM_setValue(pageKey, JSON.stringify(bannedData));
  }

  function cssUpdate(item, value) {
    item.style.setProperty('display', value, 'important');
  }

  function displayItem(info) {
    if ('ids' == info.type) {
      document.getElementById(info.val).style.display = '';
      return;
    }

    const items = document.getElementsByClassName(info.val);
    for (let i = 0; i < items.length; ++i) {
      items[i].style.display = '';
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

  const deleteElem = function (event) {
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
      cssUpdate(event.target, 'none');
      addBannedValue(id || className, id ? 'ids' : 'classes');
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

  const initObserver = function () {
    document.removeEventListener('dblclick', initObserver, false);
    document.addEventListener('dblclick', stopObserver, false);

    observer = new MutationObserver(function (mutations, obs) {
      toggleObserver();

      for (let i = 0; i < mutations.length; ++i) {
        const mut = mutations[i];

        // if ( (mut.target.id && bannedData.ids[ mut.target.id ]) || (mut.oldValue && bannedData.classes[ mut.oldValue ]) ) {
        mut.target.setAttribute(mut.attributeName, mut.oldValue);
        // }
      }

      toggleObserver();
    });

    toggleObserver();
  };

  const stopObserver = function () {
    document.removeEventListener('dblclick', stopObserver, false);
    document.addEventListener('dblclick', initObserver, false);
    toggleObserver();
    observer = null;
  };

  function toggleObserver() {
    if (!observer) {
      return;
    }

    if (observing) {
      observer.disconnect();
      observing = false;
    } else {
      observing = true;
      observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style'],
      });
    }
  }

  function delayedDeleteByClass(event, classUsers, className) {
    let i = 0;
    const classUsersCount = classUsers.length,
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
        cssUpdate(classUsers[i], 'none');
      }

      addBannedValue(className, 'classes');
      showAbort(event);
    }
  }

  function resetForCurrentDomain() {
    bannedData = { version: 2, ids: {}, classes: {}, actions: {} };
    save();
  }

  function emptySpecialActionsForCurrentDomain() {
    bannedData.actions = {};
    save();
  }

  function addSpecialAction(identifier, property, value) {
    if (!applySpecialAction(identifier, property, value)) {
      return;
    }

    bannedData.actions[identifier] = {
      property: property,
      value: value,
    };
    save();
  }

  function applySpecialAction(identifier, property, value) {
    const ids = identifier.split('::'),
      name = ids.pop(),
      type = ids[0];
    let i = 0,
      node;

    switch (type) {
      case 'tag':
        node = document.getElementsByTagName(name);
        break;

      case 'class':
        node = document.getElementsByClassName(name);
        break;

      case 'id':
        node = document.getElementById(name);
        break;

      case 'css': {
        const style = document.createElement('style');
        style.type = 'text/css';
        document.getElementsByTagName('head')[0].appendChild(style);
        style.appendChild(
          document.createTextNode(name + ' {' + property + ': ' + value + '}'),
        );
        return true;
      }
    }

    if (!node) {
      return false;
    }

    if ('undefined' == typeof node.length) {
      node.style[property] = value;
    } else {
      for (i = 0; i < node.length; ++i) {
        node[i].style[property] = value;
      }
    }

    return true;
  }

  function updateData() {
    if (!bannedData.version) {
      if (!bannedData.ids) bannedData.ids = {};
      if (!bannedData.classes) bannedData.classes = {};
      if (!bannedData.actions) bannedData.actions = {};

      let key;
      for (key in bannedData.ids) {
        if ('boolean' == typeof bannedData.ids[key]) {
          bannedData.ids[key] = 'none';
        }
      }

      for (key in bannedData.classes) {
        if ('boolean' == typeof bannedData.classes[key]) {
          bannedData.classes[key] = 'none';
        }
      }
    }

    if (bannedData.version == 2) {
      bannedData.monitorMutations = false;
    }

    bannedData.version = version;
    save();
  }
})();
