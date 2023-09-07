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
    this.popups = {};
    this.popupTriggers = [];
    this.isOpen = false;
    this.initialized;
    this.preload = true;
    this.runScripts = true;
    this.scripts = [];
    this.animation = 'none';
    this.beforeOpen = () => {
      
    };

    this.squarespace = {
      loadSiteBundle: true,
    };

    this.init();
    this.ready;
  }
  async init() {
    Popup.emitEvent('wmPopup:beforeInit');
    this.setSquarespaceLinks();
    document.body.addEventListener('click', (e) => {
      let el = e.target.closest('[data-wm-popup], a[href*="#wm-popup"], a[href*="#wmpopup"]');
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

    let handleTransitionEnd = () => {
      if (this.openPopup.singleBlock?.block) {
        this.returnSingleBlock(this.openPopup)
        this.openPopup.singleBlock = {}
      }
      popup.classList.remove('single-block-only')
      popupWrapper.removeEventListener('transitionend', handleTransitionEnd);
      this.openPopup.trigger.focus()
      this.openPopup = null;
    }
    this.resetNonNativeVideoBlocks();
    popupWrapper.removeEventListener('transitionend', handleTransitionEnd); 
    popupWrapper.addEventListener('transitionend', handleTransitionEnd);
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
    let section = document.querySelector('#sections > .page-section:last-child .content-wrapper');
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
    const fetchPromises = urls.map(url => fetch(url));
    
    await Promise.all(fetchPromises)
      .then(async responses => {
        const textPromises = responses.map(async response => {
          if (response.ok) {
            const text = await response.text(); 
            return {
              url: new URL(response.url).pathname,
              text: text
            };
          }
          return {
            url: new URL(response.url).pathname,
            text: false
          };
        });
    
        const textResponses = await Promise.all(textPromises);

        textResponses.forEach(res => {
          const parser = new DOMParser();
          if (res.text){
            const doc = parser.parseFromString(res.text, 'text/html');
            const content = doc.querySelector('#sections'); 
            this.popups[res.url].content = content.innerHTML
          } else {
            this.popups[res.url].content = `<section class="page-section error-section">
              <div class="section-border"></div>
              <div class="content-wrapper">
                <p>The URL, <code>${res.url}</code>, does not exist on your website.</p>
              </div>
            </section>`;
          }

        })

      })
      .catch(error => {
        console.error('An error occurred:', error);
      });
    
    for (let id in this.popups) {
      this.buildPopup(id)
    }
  }
  setSquarespaceLinks() {
    this.squarespace.links = document.querySelectorAll('a[href*="#wm-popup"], a[href*="#wmpopup"]');
    
    this.squarespace.links.forEach(el => {
      let urlData = new URL(el.href);
      let hash = urlData.hash;
      let url = hash.split('=')[1];
      let block;
      if (url.includes('#')) {
        url = url.split('#')[0]
        block = hash.split('#')[2] || null;
      }
      el.href
      el.setAttribute('data-wm-popup', url);
      if (block) el.setAttribute('data-wm-popup-block', '#' + block);
    });
  }
  async loadScripts() {
    if (!this.runScripts) return;
  
    const hasLoaded = new Set();
  
    if (this.squarespace.loadSiteBundle) {
      /*Note: List Sections Won't Render if display:none;*/
      let script = document.querySelector('body > [src*="https://static1.squarespace.com/static/vta"]');
      this.scripts.push(script);
    }
  
    const scriptPromises = this.scripts.map(async el => {
      if (hasLoaded.has(el.src) || (el.innerHTML && hasLoaded.has(el.innerHTML))) {
        return;
      }
      const script = document.createElement('script');
      script.src = el.src;
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
    popup.singleBlock = {
      block: block,
      originalParent:  block.parentElement,
      nextSibling: block.nextElementSibling
    }
    if (isVideo) {
      let video = block.querySelector('video');
      video.muted = false;
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
    })
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
}

let wmPopups = new Popup();
