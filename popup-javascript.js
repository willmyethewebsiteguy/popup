/* =========
  Squarespace Popups
  A simple Popup Plugin for Squarespace
  This Code is Licensed by Will-Myers.com
========== */
class Popup {
  static emitEvent (type, detail = {}, elem = document) {
  
  	// Make sure there's an event type
  	if (!type) return;
  
  	// Create a new event
  	let event = new CustomEvent(type, {
  		bubbles: true,
  		cancelable: true,
  		detail: detail
  	});
  
  	// Dispatch the event
  	return elem.dispatchEvent(event);
  
  }
    
  constructor() {
    const self = this;
    this.userSettings = window.wmPopupSettings || {};
    this.popups = {};
    this.popupTriggers = [];
    this.isOpen = false;
    this.triggerSelector = this.userSettings.triggerSelector || 'a[href*="#wm-popup"], a[href*="#wmpopup"]';
    this.initialized;
    this.preload = true;
    this.runScripts = true;
    this.scripts = [];
    this.animation = 'none';
    this.beforeOpen = () => {
      
    };
    this.squarespace = {
      loadSiteBundle: true,
      /*links: document.querySelectorAll(this.triggerSelector),*/
      get links() {
        return document.querySelectorAll(self.triggerSelector);
      }
    };
    this.hasGallerySection = false;
    this.hasListSection = false;
    this.hasVideo = false;
    this.hasBkgVideo = false;

    this.init();
    this.ready;
  }
  async init() {
    if (!this.squarespace.links) return;
    
    //this.flexAnimationWorkAround();
    
    Popup.emitEvent('wmPopup:beforeInit');
    this.setSquarespaceLinks();
    document.body.addEventListener('click', (e) => {
      let selector = this.triggerSelector += ', [data-wm-popup]'
      let el = e.target.closest(selector);
      if (el) {
        e.stopPropagation();
        e.preventDefault();
        this.open(el);
      }
      if (e.target.closest('[data-popup-close]')) {
        e.stopPropagation();
        e.preventDefault();
        this.close();
      }
    });
    await this.buildPopups();
    await this.loadScripts();
    for (let id in this.popups) {
      let popup = this.popups[id].popup;
      this.initializeBlocks(popup);
    }
    this.rearrangePopups();
    this.close();
    Popup.emitEvent('wmPopup:ready');
    this.ready = true;
  }
  
  open(el) {
    let id =  el.dataset.wmPopup;
    let popup = this.popups[id];
    if (!popup && !el.dataset.popupContent) return;
    this.freezeScroll();
    document.body.classList.add('wm-popup-open')
    if (el.dataset.popupContent) {
      this.popups[id] = {
        content: el.dataset.popupContent,
        singleBlock: {},
        id: id
      }
      this.buildPopup(id)
      let siteWrapper = document.querySelector('#siteWrapper');
      popup = this.popups[id];
      siteWrapper.append(popup.popup);
    } 
    Popup.emitEvent('wmPopup:beforeOpen', popup);
    this.openPopup = this.popups[id];
    this.openPopup.trigger = el;
    let popupEl = popup.popup;
    let singleBlock = el.dataset.wmPopupBlock;
    if (singleBlock) this.placeSingleBlock(popup, singleBlock);
    popupEl.classList.add('open');
    this.setFocusOnFirstElement(popupEl)
    this.checkIfVideoAutoplay();
    window.dispatchEvent(new Event('resize'));
    Popup.emitEvent('wmPopup:afterOpen', popup); 
  }
  close() {
    if (!this.openPopup) return;
    let popup = this.openPopup.popup;
    Popup.emitEvent('wmPopup:beforeClose', popup);
    let popupWrapper = popup.querySelector('.wm-popup-wrapper')
    if (popup.querySelector('video')) {
      popup.querySelectorAll('video').forEach(vid => vid.pause());
    }
    if (popup.querySelector('.sqs-block-video iframe[src*="autoplay=1"]')) {
      const iframe = popup.querySelector('.sqs-block-video iframe[src*="autoplay=1"]');
      iframe.src = iframe.src.replace('autoplay=1', '');
    }
    this.resetNonNativeVideoBlocks();

    let handleTransitionEnd = () => {
      if (!this.openPopup) return;
      if (this.openPopup.singleBlock?.block) {
        this.returnSingleBlock(this.openPopup);
        this.openPopup.singleBlock = {};
      }
      popup.classList.remove('single-block-only');
      this.openPopup.trigger.focus();
      this.openPopup = null;
    };
    const afterTransition = (element, callback) => {
      // Get computed styles for the element
      const style = window.getComputedStyle(element);
      const duration = parseFloat(style.transitionDuration);
    
      // Check if there's a transition duration
      if (duration > 0) {
          // If there's a transition, add the event listener
          const listener = function(event) {
              if (event.target === element) {
                  callback();
                  // Clean up: remove the event listener once it's called
                  element.removeEventListener('transitionend', listener);
              }
          };
      
              element.addEventListener('transitionend', listener);
          } else {
              // If there's no transition, call the function directly
              callback();
          }
      }
    afterTransition(popupWrapper, handleTransitionEnd);
    
    document.body.classList.remove('wm-popup-open')
    popup.classList.remove('open');
    this.unfreezeScroll();
    Popup.emitEvent('wmPopup:afterClose', popup);
  }

  buildPopup(id){
    let item = this.popups[id];
    let popupTemplate = (HTMLContent) => {
      let html = `
        <div tabindex="-1" data-popup-close class="wm-popup-background"></div>
        <div role="dialog" aria-modal="true" class="wm-popup-wrapper">
          <button aria-label="Close popup" data-popup-close class="wm-popup-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div class="wm-popup-content">
            ${HTMLContent}
          </div>
        </div>`;
      return html;
    } 
    let section = document.querySelector('#sections > .page-section:last-of-type .content-wrapper');
    item.popup = document.createElement('div');
    item.popup.dataset.popupId = id;
    item.popup.classList.add('wm-popup-container');
    item.popup.setAttribute('aria-hidden', true);
    item.popup.innerHTML = popupTemplate(item.content);
    section.append(item.popup)
    this.animation = this.getPropertyValue(item.popup, '--animation') || 'none';
    item.popup.dataset.animation = this.animation;
  }
  async buildPopups() {
    this.popupTriggers = document.querySelectorAll('[data-wm-popup]');
    for (let el of this.popupTriggers) {
      let val = el.dataset.wmPopup;
      if (this.popups[val]) continue;
      let origin = window.location.origin;
      let url = null;
      let content = el.dataset.popupContent;
      if (val.includes('/')) url = new URL(origin + val).pathname;
      this.popups[val] = {
        url: url,
        loaded: false,
        content: content,
        id: val,
        popup: null
      };
    }
    /*Get Data*/
    const urls = []
    for (const id in this.popups) {
      const url = this.popups[id].url;
      if (url) urls.push(url);
    }
    const fetchPromises = urls.map(url => {
      return fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response;
        })
        .catch(error => {
          console.error(`Failed to fetch ${url}:`, error);
          return null; // Return null for failed requests
        });
    });
    
    try {
      const responses = await Promise.all(fetchPromises);
      const textPromises = responses.map(async (response, index) => {
        if (response === null) {
          console.log(`Skipping processing for failed request: ${urls[index]}`);
          return {
            url: urls[index],
            text: false
          };
        }
        try {
          const text = await response.text();
          return {
            url: new URL(response.url).pathname,
            text: text
          };
        } catch (error) {
          console.error(`Error processing response for ${response.url}:`, error);
          return {
            url: new URL(response.url).pathname,
            text: false
          };
        }
      });
  
      const textResponses = await Promise.all(textPromises);
      textResponses.forEach(res => {
        if (!res) {
          console.log('Skipping null response');
          return;
        }
        const parser = new DOMParser();
        if (res.text){
          const doc = parser.parseFromString(res.text, 'text/html');
          const content = doc.querySelector('#sections');
          if (content) {
            this.popups[res.url].content = content.innerHTML;
            if (content.querySelector('.user-items-list')) this.hasListSection = true;
            if (content.querySelector('.sqs-block-video')) this.hasVideo = true;
            if (content.querySelector('.gallery-section')) this.hasGallerySection = true;
            if (content.querySelector('.sqs-video-background-native, .section-background #player')) this.hasBkgVideo = true;
          } else {
            console.warn(`No #sections found in the response for ${res.url}`);
            this.popups[res.url].content = `<section class="page-section error-section"><div class="content-wrapper"><p>No content found for ${res.url}</p></div></section>`;
          }
        } else {
          this.popups[res.url].content = `<section class="page-section error-section">
            <div class="section-border"></div>
            <div class="content-wrapper">
              <p>The URL, <code>${res.url}</code>, does not exist on your website.</p>
            </div>
          </section>`;
        }
      })
    } catch (error) {
      console.error('An error occurred during fetch operations:', error);
    }
  
    for (let id in this.popups) {
      this.buildPopup(id)
    }
  }
  setSquarespaceLinks() {
    this.squarespace.links.forEach(el => {
      let urlData = new URL(location.origin + el.getAttribute('href'));
      let hash = urlData.hash;
      let url = urlData.href.split('=')[1];
      let block;
      if (url.includes('#')) {
        url = url.split('#')[0]
        block = hash.split('#')[2] || null;
      }
      el.setAttribute('data-wm-popup', url ? url : window.location.pathname);
      if (block) el.setAttribute('data-wm-popup-block', '#' + block);
    });

    Popup.emitEvent('wmPopup:afterTriggersSet');
  }
  async loadScripts() {
    if (!this.runScripts) return;
  
    const hasLoaded = new Set();
  
    if (this.squarespace.loadSiteBundle) {
      /*Note: List Sections Won't Render if display:none;*/
      if (this.hasGallerySection || this.hasListSection || this.hasVideo || this.hasBkgVideo) {
        this.flexAnimationWorkAround();
        let script = document.querySelector('body > [src*="https://static1.squarespace.com/static/vta"]');
        this.scripts.push(script);
      }
    }

    document.querySelectorAll('script[data-popup-loaded], .wm-popup-container script').forEach(el => {
      this.scripts.push(el);
    })
  
    const scriptPromises = this.scripts.map(async el => {
      if (hasLoaded.has(el.src) 
          || (el.innerHTML && hasLoaded.has(el.innerHTML))
          || el.type === 'application/json') {
        return;
      }
      const script = document.createElement('script');
      script.src = el.src || el.dataset.popupScript;
      script.async = el.async;
  
      if (el.innerHTML) {
        eval(el.innerHTML);
        hasLoaded.add(el.innerHTML);
      } else {
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        hasLoaded.add(el.src);
      }
    });
    
    await Promise.all(scriptPromises);
  }
  initializeBlocks(el) {
    window.Squarespace?.initializeLayoutBlocks(Y, Y.one(el));
    window.Squarespace?.initializeNativeVideo(Y, Y.one(el));
    window.Squarespace?.initializeWebsiteComponent(Y, Y.one(el))

    //window.Squarespace?.initializeCommerce(Y, Y.one(el))
    this.initializeCommerce(el)
  }
  initializeCommerce(el) {
    const addToCartButtons = el.querySelectorAll('.sqs-add-to-cart-button');
    const shouldInitialize = addToCartButtons.length > 0;
    
    if (!shouldInitialize) return;
  
    const afterpayComponents = document.querySelectorAll('[data-afterpay="true"]');
    const context = window.Static?.SQUARESPACE_CONTEXT;
    const nativeProductReviewsEnabled = context?.websiteSettings?.storeSettings?.merchandisingSettings?.displayNativeProductReviewsEnabled;
  
    // Remove event listeners from "add to cart" buttons
    addToCartButtons.forEach(button => {
      const clone = button.cloneNode(true);
      button.parentNode.replaceChild(clone, button);
    });
  
    // Temporarily disable Afterpay and native product reviews
    afterpayComponents.forEach(el => el.removeAttribute('data-afterpay'));
    if (context?.websiteSettings?.storeSettings?.merchandisingSettings) {
      context.websiteSettings.storeSettings.merchandisingSettings.displayNativeProductReviewsEnabled = false;
    }
  
    // Reinitialize Squarespace Commerce
    if (typeof Y !== 'undefined' && Y.Squarespace && Y.Squarespace.Commerce) {
      Y.Squarespace.Commerce.initializeCommerce();
    } else {
      console.warn('Squarespace Commerce object not found. Commerce initialization skipped.');
    }
  
    // Restore Afterpay and native product reviews settings
    afterpayComponents.forEach(el => el.setAttribute('data-afterpay', 'true'));
    if (context?.websiteSettings?.storeSettings?.merchandisingSettings) {
      context.websiteSettings.storeSettings.merchandisingSettings.displayNativeProductReviewsEnabled = nativeProductReviewsEnabled;
    }
  }
  rearrangePopups(){
    let siteWrapper = document.querySelector('#siteWrapper');
    for (let id in this.popups) {
      let popup = this.popups[id].popup
      siteWrapper.append(popup);
    }
  }
  placeSingleBlock(popup, singleBlock) {
    let block = popup.popup.querySelector(singleBlock);
    let isVideo = block.matches('.sqs-block-video');
    const isImageBlock = block.matches('.sqs-block-image');
    popup.singleBlock = {
      block: block,
      originalParent:  block.parentElement,
      nextSibling: block.nextElementSibling
    }
    if (isVideo) {
      let video = block.querySelector('video');
      if (video) video.muted = false;
    }
    popup.popup.querySelector('.page-section .content-wrapper').append(block);
    popup.popup.classList.add('single-block-only');
  }
  returnSingleBlock(openPopup){
    let singleBlock = openPopup.singleBlock;
    const element = singleBlock?.block;
    const parent = singleBlock?.originalParent;
    const nextSibling = singleBlock?.originalNextSibling;
  
    // Move the element back to its original position
    if (nextSibling) {
      parent.insertBefore(element, nextSibling);
    } else {
      parent.appendChild(element);
    }
  }
  getPropertyValue(el, prop) {
    let propValue = window.getComputedStyle(el).getPropertyValue(prop),
        cleanedValue = propValue.trim().toLowerCase(),
        value = cleanedValue;
  
    /*If First & Last Chars are Quotes, Remove*/
    if (cleanedValue.charAt(0).includes('"') || cleanedValue.charAt(0).includes("'")) value = value.substring(1);
    if (cleanedValue.charAt(cleanedValue.length-1).includes('"') || cleanedValue.charAt(cleanedValue.length-1).includes("'")) value = value.slice(0, -1);;
  
    if (value == 'true') value = true;
    if (value == 'false') value = false;
    return value;
  }
  setFocusOnFirstElement(el) {
    window.setTimeout(() => {
      const firstFocusableElement = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
      if (firstFocusableElement) firstFocusableElement.focus()
    }, 100)
  }
  freezeScroll() {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
  };
  unfreezeScroll() {
    const body = document.body;
    const scrollY = body.style.top;
    body.style.position = '';
    body.style.top = '';
    window.scrollTo({
      top: parseInt(scrollY || '0') * -1,
      left: 0,
      behavior: "instant",
    });
  };
  checkIfVideoAutoplay() {
    //For Native Videos
    let nativeVideo = this.openPopup.popup.querySelector('.sqs-native-video[data-config-settings]');
    if (nativeVideo) {
      let video = nativeVideo.querySelector('video')
      let settings = JSON.parse(nativeVideo.dataset.configSettings);
      if (!settings) return;
      let autoPlay = settings.autoPlay;
      if (autoPlay) {
        video.play()
        video.currentTime = 0
      }
    }
  }
  resetNonNativeVideoBlocks() {
    let nonNativeVideoBlock = this.openPopup.popup.querySelector('.sqs-block-video iframe')
    if (!nonNativeVideoBlock) return;
    this.initializeBlocks(this.openPopup.popup)
  }
  flexAnimationWorkAround() {

    function resetFlex() {
      let elements = Array.from(document.querySelectorAll('.animation-segment-parent-hidden'));
      //elements = Array.from(document.querySelectorAll('.sqs-html-content h2'));
      let positions = elements.map(el => ({
          element: el,
          clone: el.cloneNode(true),
          parent: el.parentNode,
          sibling: el.previousElementSibling
      }));
      positions.forEach(pos => {
          pos.element.parentNode.removeChild(pos.element);
          pos.clone.classList.remove('animation-segment-parent-hidden');
          if (pos.sibling) {
              // If there was a previous sibling, insert after it
              pos.parent.insertBefore(pos.clone, pos.sibling.nextElementSibling);
          } else {
              // Otherwise, insert as the first child of the parent
              pos.parent.insertBefore(pos.clone, pos.parent.firstElementChild);
          }
      });
    }
    if (document.readyState === 'loading') {
        window.addEventListener('load', () => {
          if (window.top === window.self) {
            resetFlex();
          } else {
            window.Squarespace.onInitialize(Y, function(){
              window.setTimeout(resetFlex, 200)
            });
          }
        });
    } else {
        // Document is already loaded, directly call the function
        resetFlex();
    }
    
  }
}

let wmPopups = new Popup();
