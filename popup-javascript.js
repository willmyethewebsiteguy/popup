/* =========
  Testing Popups
  A simple Popup Plugin for Squarespace
  This Code is Licensed by Will-Myers.com
========== */
(function () {
  const builtPopups = [];
  const utils = {
    emitEvent: function (type, detail = {}, elem = document) {
      if (!type) return;
      let event = new CustomEvent(type, {
        bubbles: true,
        cancelable: true,
        detail: detail,
      });
      return elem.dispatchEvent(event);
    },
    async getHTML(url, selector = null) {
      try {
        let response = await fetch(`${url}`);

        // If the call failed, throw an error
        if (!response.ok) {
          throw `Something went wrong with ${url}`;
        }

        let data = await response.text(),
            frag = document.createRange().createContextualFragment(data),
            section = frag.querySelector('#sections');

        if (selector) section = frag.querySelector(selector);

        return section;

      } catch (error) {
        console.error(error);
      }
    },
    getPropertyValue: function (el, prop) {
      let propValue = window.getComputedStyle(el).getPropertyValue(prop),
          cleanedValue = propValue.trim().toLowerCase(),
          value = cleanedValue;

      /*If First & Last Chars are Quotes, Remove*/
      if (cleanedValue.charAt(0).includes('"') || cleanedValue.charAt(0).includes("'")) value = value.substring(1);
      if (cleanedValue.charAt(cleanedValue.length-1).includes('"') || cleanedValue.charAt(cleanedValue.length-1).includes("'")) value = value.slice(0, -1);;

      if (cleanedValue == 'true') value = true;
      if (cleanedValue == 'false') value = false;

      return value;
    },
  };

  let WMPopup = (function () {
    let closeEventListenerAdded = false;
    
    function addClickEvent(instance) {
      let btn = instance.elements.btn;
      
      function handleEvent(e){
        e.preventDefault();
        e.stopPropagation();
        instance.open();
      }

      btn.addEventListener('click', handleEvent, true);
    }
    
    function addCloseEventListener(instance){
      if (closeEventListenerAdded) return;

      function handleEvent(e){
        if (!e.target.hasAttribute('data-popup-close')) return;
        e.preventDefault();
        e.stopPropagation();
        instance.close();
      }
      
      document.addEventListener('click', handleEvent, true);
      closeEventListenerAdded = true;
    }
    
    function autoplayVideos(instance) {
      let video = instance.elements.container.querySelector('video'),
          sectionBackgroundVideo = instance.elements.sectionBackgroundVideo;

      video.play();
      if (sectionBackgroundVideo) sectionBackgroundVideo.pause();
    }
    
    function stopAllVideos(instance) {
      let videos = instance.elements.container.querySelectorAll('video'),
          sectionBackgroundVideo = instance.elements.sectionBackgroundVideo;
      
      for (let video of videos){
        video.pause();
      }
      if (sectionBackgroundVideo) sectionBackgroundVideo.play();
    }
    
    function addLoadEventListener(instance){
      let blocks = instance.elements.blocks,
          str = instance.settings.str;

      Squarespace.initializeLayoutBlocks(Y, Y.one(`[data-wm-popup-content="${str}"]`))

      for (let block of blocks) {
        let cl = block.classList;
        let id = block.id;
        if (cl.contains('sqs-block-video')) {
          Squarespace?.initializeNativeVideo(Y, Y.one(`#${id}`));
        }
      }
    }
    
    function changeHref(instance) {
      if (!instance.elements.btn.href) return;
      instance.elements.btn.href = '#'
    }
    
    function setAttribute(instance){
      let btn = instance.elements.btn,
          href = btn.href;

      if (!href) href = btn.data.wmPopup;

      let target = href.split('popup=')[1];

      if (target.includes('=')) target.replace("=", '');

      instance.settings.urlData = target;
      btn.dataset.wmPopup = target;
      btn.href = '#';
    }

    async function buildHTML(instance) {
      let str = instance.settings.str,
          url = instance.settings.url,
          selectorID = instance.settings.selectorID,
          popupEl = document.querySelector(`[data-wm-popup-content="${str}"]`);

      if (builtPopups.includes(str)) return;
      builtPopups.push(str);
      
      //if (popupEl) return popupEl;
      
      let html = await utils.getHTML(url, selectorID);
      let popupHTML = `
      <div class="wm-popup-container" data-wm-popup-content="${str}" aria-hidden="true">
        <div tabindex="-1" data-popup-close class="wm-popup-background">
          <div role="dialog" aria-modal="true" class="wm-popup-wrapper">
            <button aria-label="Close popup" data-popup-close class="wm-popup-close-btn">×</button>
            <div class="wm-popup-content">
            </div>
          </div>
        </div>
      </div>
      `; 
      
      document.querySelector('#siteWrapper')
        .insertAdjacentHTML('beforeend', popupHTML);
      let contentContainer = instance.elements.contentContiner;
      contentContainer.append(html);
      popupEl = instance.elements.container;
      
      //If only contains video Block, pull video out and remove everything else;
      let popupVideo = popupEl.querySelector('.sqs-block-video');
      let onlyOneBlock = popupEl.querySelectorAll('.sqs-block').length == 1 ? true : false;
      if (popupVideo && onlyOneBlock) {
        contentContainer.innerHTML = '';
        contentContainer.append(popupVideo);
        popupEl.classList.add('popup-video');
        instance.settings.onlyVideo = true;
      }

      addLoadEventListener(instance);      
      return popupEl;
    }

    function Constructor(btn) {
      if (btn.popupEl) return;
      
      let section = btn.closest('.page-section');
      
      let instance = this;
      instance.isOpen = false;
      instance.settings = {
        urlData: '',
        get hasAutoplay() {
          return this.urlData.includes('?autoplay')
        },
        get str() {
          return btn.dataset.wmPopup;
        },
        get url() {
          let target = this.str;
          if (target.includes('#')) target = target.split('#')[0];
          return target;
        },
        get selectorID() {
          let target = this.str;
          if (target.includes('?')) target = target.split('?')[0];
          if (target.includes('#')) {
            target = target.split('#')[1]
            return '#' + target;
          } else {
            return null;
          }
        },
        get autoplayVideo() {
          return utils.getPropertyValue(instance.elements.container, '--autoplay-video')
        },
        onlyVideo: false
      };
      instance.elements = {
        btn: btn,
        section: section,
        get container() {
          let el = document.querySelector(`[data-wm-popup-content="${instance.settings.urlData}"]`);
          return el
        },
        get contentContiner() {
          return this.container.querySelector(`.wm-popup-content`)
        },
        get blocks() {
          return this.container.querySelectorAll(`.sqs-block`)
        },
        get sectionBackgroundVideo() {
          return this.section.querySelector('.section-border video');
        }
      };
            
      setAttribute(instance);
      instance.popupEl = buildHTML(instance);
      addClickEvent(instance);
      addCloseEventListener(instance);
    }
    
    Constructor.prototype.open = function() {
      this.elements.container.classList.add('open')
      document.body.classList.add('wm-popup-open');
      
      if (this.settings.hasAutoplay) {
        autoplayVideos(this);
      }
      
      if (this.settings.onlyVideo && this.settings.autoplayVideo) {
        this.elements.container.querySelector('video')?.play();
      }
    }

    Constructor.prototype.close = function() {
      let openPopup = document.querySelector('.wm-popup-container.open')
      openPopup.classList.remove('open');
      document.body.classList.remove('wm-popup-open');
      stopAllVideos(this);
    }

    return Constructor;
  }());

  let initPopups = () => {
    let popupBtns = document.querySelectorAll('a[href*="#wmpopup="], a[href*="#wm-popup="], a[href*="/wmpopup="], a[href*="/wm-popup="], [data-wm-popup]');
    for (let btn of popupBtns) {
      new WMPopup(btn);
    }
  }
  initPopups();
  window.wmInitPopups = initPopups;
}());
