/* =========
  Popup Component
  A simple Popup Plugin for Squarespace
  This Code is Licensed by Will-Myers.com
========== */


const wmPopup = (function() {
  
  let popups = {};
  let initialized = false;
  let isOpen = false;
  let activeId = null;
  let defaults = {
    preload: true,
    autoplayVideos: true,
    entranceAnimation: true,
    baseInit: ['#wm-popup=']
  }
  let userParams = window.wmPopupSettings || {};
  let options = {};
  let baseSelector = '#sections'
  let elements = {
    body: document.body,
//    page: document.querySelector('#footer-sections .sqs-block:last-child') || document.querySelector('body'),
    siteWrapper: document.querySelector('#siteWrapper'),
    
    popupParent: document.querySelector('#sections > .page-section:last-child'), //Container that the popup goes into, needs to be a page-section so SS code will run
    container: null,
    popupBackground: null,
    closeBtn: null,
    popupContent: null
  }
  let activeContainer;
  let scriptsToLoad = [];

  /*Utilities*/
  function deepMerge (...objs) {
  	function getType (obj) {
  		return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
  	}

  	function mergeObj (clone, obj) {
  		for (let [key, value] of Object.entries(obj)) {
  			let type = getType(value);
  			if (clone[key] !== undefined && getType(clone[key]) === type && ['array', 'object'].includes(type)) {
  				clone[key] = deepMerge(clone[key], value);
  			} else {
  				clone[key] = structuredClone(value);
  			}
  		}
  	}
  
  	let clone = structuredClone(objs.shift());
  
  	for (let obj of objs) {
  		let type = getType(obj);
  		if (getType(clone) !== type) {
  			clone = structuredClone(obj);
  			continue;
  		}
  		if (type === 'array') {
  			clone = [...clone, ...structuredClone(obj)];
  		} else if (type === 'object') {
  			mergeObj(clone, obj);
  		} else {
  			clone = obj;
  		}
  	}
  	return clone;
  }

  /*Private Functions*/
  function buildContainer(){
    let html = `<div class="wm-popup-container" aria-hidden="true">
        <div tabindex="-1" data-popup-close class="wm-popup-background"></div>
        <div role="dialog" aria-modal="true" class="wm-popup-wrapper">
          <button aria-label="Close popup" data-popup-close class="wm-popup-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div class="wm-popup-content"></div>
        </div>
      </div>`;
    
    elements.popupParent.insertAdjacentHTML('beforeend', html);
    elements.container = document.querySelector('.wm-popup-container');
    elements.popupBackground = document.querySelector('.wm-popup-background');
    elements.closeBtn = document.querySelector('.wm-popup-close-btn');
    elements.popupContent = document.querySelector('.wm-popup-content');
  }
  function setLinks() {
    let links = document.querySelectorAll('[href*="#wm-popup"], [href*="#wmpopup"]');
    let root = window.location.origin;
    links.forEach(el => {
      let val = el.getAttribute('href').split('=')[1];
      let url  = new URL(root + val);
      let path = url.pathname;
      let selector = url.hash;
      let autoplay = url.searchParams.get('autoplay');
      if (autoplay !== null || options.autoplayVideos) {
        autoplay = true;
      } else {
        autoplay = false;
      }

      el.dataset.wmPopup = path;

      let selectors = [];
      if (popups[path]) {
        selectors = popups[path].selectors;
      }
      if (selector) {
        if (!selectors.includes(selector)) selectors.push(selector);
        el.dataset.wmPopupSelector = selector;
      } 

      if (!popups[path]) {
        popups[path] = {
          path: path,
          selectors: selectors,
        };
      }

      if (window.self !== window.top) {
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
      } else {
        el.href = '#'
      }
    });
  }
  function returnElement(id) {
    const element = popups[id].movedEl;
    const parent = popups[id].returnParent;
    const nextSibling = popups[id].nextSibling;
  
    // Move the element back to its original position
    if (nextSibling) {
      parent.insertBefore(element, nextSibling);
    } else {
      parent.appendChild(element);
    }
  }
  async function fetchHTML(url, selector = '#sections') {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const selectedContent = doc.querySelector(selector).innerHTML;
      return selectedContent;
    } catch (error) {
      console.error('Error fetching HTML:', error);
      return null;
    }
  }
  async function buildAllPopups() {
    const promises = [];
  
    for (let id in popups) {
      let popup = popups[id];
      promises.push(buildPopup(id));
    }
  
    try {
      await Promise.all(promises);
      // All fetch requests have completed, continue with the next function here
      checkForSquarespaceScripts();
      loadScripts();
      initializeScripts();
    } catch (error) {
      console.error(error);
    }
  } 
  async function buildPopup(id) {
    let popup = popups[id];
    if (popup.init) return;
    popup.init = true;
    try {
      const content = await fetchHTML(popup.path);
      elements.popupContent.insertAdjacentHTML('beforeend', `<div data-wm-popup="${id}">${content}</div>`);
      let container = elements.popupContent.querySelector(`[data-wm-popup="${id}"]`);
      let contentWrapper = container.querySelector('.content-wrapper');
      contentWrapper.insertAdjacentHTML('beforeend','<div class="single-block-container"></div>');
      popup.container = container;
      popup.singleBlockContainer = container.querySelector('.single-block-container');
    } catch (error) {
      console.error(error);
    }
  }
  function checkForSquarespaceScripts(){
    /*Like Background Videos*/
    let hasBkgVideos = elements.container.querySelectorAll('.section-background .sqs-video-background-native').length;
    let hasListSection = elements.container.querySelectorAll('.page-section.user-items-list-section');
    let hasGallerySection = elements.container.querySelectorAll('.page-section.gallery-section');
    
    /*If Background Video or Gallery Section*/
    if (hasBkgVideos || hasListSection || hasGallerySection) {

      let sqsLoaderScript = document.querySelector('body > [src*="https://static1.squarespace.com/static/vta"]');
      scriptsToLoad.push(sqsLoaderScript)
    }
  }
  function loadScripts() {
    if (!scriptsToLoad.length) return;
    let hasLoaded = [];
    for (let el of scriptsToLoad){
      if (hasLoaded.includes(el.src) || hasLoaded.includes(el.innerHTML)) continue;
      const script = document.createElement('script');
      script.src = el.src;
      script.async = el.async;

      if (el.innerHTML) {
        eval(el.innerHTML);
        hasLoaded.push(el.innerHTML)
      } else {
        document.body.appendChild(script);
        hasLoaded.push(el.src)
      }
    }
  }
  function initializeScripts() {
    window.Squarespace?.initializeLayoutBlocks(Y, Y.one(elements.container));
    window.Squarespace?.initializeNativeVideo(Y, Y.one(elements.container));
  }
  async function loadSiteBundle() {
    const siteBundle = document.querySelector('body > [src*="https://static1.squarespace.com/static/vta"]');
    const script = document.createElement('script');
    script.src = siteBundle.src;
    script.async = siteBundle.async;
  
    const scriptLoaded = new Promise((resolve, reject) => {
      script.addEventListener('load', resolve);
      script.addEventListener('error', reject);
    });

    document.body.appendChild(script);

    await scriptLoaded;
  }

  /*Public Functions*/
  function init() {
    options = deepMerge(defaults, userParams);
    setLinks();
    
    if (initialized) return;
    
    initialized = true;
    buildContainer();
    if (options.preload) {
      buildAllPopups();
    }

    /*Open Event*/
    elements.body.addEventListener('click', function(e){
      if (!e.target.closest('[data-wm-popup]:not(.open)')) return;
      e.preventDefault()
      e.stopPropagation();
      let trigger = e.target.closest('[data-wm-popup]')
      let id = trigger.dataset.wmPopup;
      let target = trigger.dataset.wmPopupSelector;
      let autoplay = trigger.dataset.autoPlay || options.autoplayVideo;

      open(id, target, autoplay)
    });

    /*Close Event*/
    document.addEventListener('click', function(e){
      if (!e.target.closest('[data-popup-close]')) return;
      close()
    });
  }
  function render() {
    setLinks();
  }
  async function open(id, target, autoplay = false) {
    if (!popups[id] || !popups[id].init) {
      await buildPopup(id);
      initializeScripts();
      await loadSiteBundle();
    }
    isOpen = true;
    activeId = id;
    activeContainer = popups[id].container;
    if (target) {
      let targetEl = activeContainer.querySelector(target);
      popups[id].returnParent = targetEl.parentNode;
      popups[id].nextSibling = targetEl.nextSibling;
      popups[id].movedEl = targetEl;
      popups[id].singleBlockContainer.append(targetEl);
      activeContainer.classList.add('single-block-only');
    }
    elements.siteWrapper.append(elements.container)
    elements.container.classList.add('open');
    activeContainer.classList.add('open');
  }
  function close() {
    isOpen = false;
    elements.container.classList.remove('open');
    activeContainer.classList.remove('open');
    elements.popupParent.append(elements.container)
    if (activeContainer.matches('.single-block-only')) {
      returnElement(activeId)
      activeContainer.classList.remove('single-block-only');
    }
    activeId = null;
  }

  return {
    open: open, // Public method
    close: close, // Public method
    render: render,
    init: init,
    popups: popups
  }; 
})();

/*Init*/
if (document.querySelector('[href*="#wm-popup"], [href*="#wmpopup"]')) {
  wmPopup.init();
}
