/* =========
  Testing Popups
  A simple Popup Plugin for Squarespace
  This Code is Licensed by Will-Myers.com
========== */
(function(){
  /*Collect All Possible Popup Init Buttons*/
  let builtPopups = [];

  function buildSQSPopupHTML(btn) {
    let btnInput = btn.href.split('=')[1] || btn.href.split('wmpopup-')[1]  || btn.href.split('wm-popup-')[1],
        content,
        id,
        isInfo = btn.innerText == 'i' ? true : false;

    if (isInfo) {
      btn.innerText = '';
      btn.classList.add('wm-info-icon')
    }

    /*Build Popup if it doesn't exist*/
    if (btnInput.startsWith('/')) {
      id = btnInput;
      if (!$(`[data-popup-id="${id}"]`).length){
        let block = id.split('#'),
            item = '#sections > .page-section';
        if (block.length > 1){
          item = `#${block[1]}`;
        }
        $.get(btnInput, function (data) {
          content = $(data).find(item);
          if(!$(`[data-popup-id="${id}"]`).length) {
            buildHTML(id, content)
          }
          //window.Squarespace.globalInit(Y);
          btn.dispatchEvent(new Event('wmPopupLoaded'));
          1
          /*Load Images*/
          let images = document.querySelectorAll(`[data-popup-id="${id}"] img[data-src]`);
          for (var i = 0; i < images.length; i++) {
            ImageLoader.load(images[i], {load: true});
          }
        });
      }
      openTrigger(id);
    } else if (!isNaN(btnInput.charAt(0))) {
      id = 'data-section-id=' + btnInput;
      content = document.querySelector('[data-section-id="' + btnInput + '"]');
      if(!$(`[data-popup-id="${id}"]`).length) {
        buildHTML(id, content)
      }
      openTrigger(id);
    }
    else if (btnInput.startsWith('#')) {
      id = btnInput;
      content = document.querySelector(btnInput);
      if(!$(`[data-popup-id="${id}"]`).length) {
        buildHTML(id, content)
      }      
      openTrigger(id);
    } else {
      return;
    }

    /*Add Open Trigger*/
    function openTrigger(id) {
      btn.addEventListener('click', clickEvent, true);
    }

    function clickEvent(e) {
      console.log('click')
      e.preventDefault();
      e.stopPropagation();
      openPopup();
      try {
        btn.dispatchEvent(new Event(id+ '#wmPopupOpen'));
      } catch {
        console.log(`couldn't send custom Close Event`)
      }
    }

    function openPopup() {
      $(`[data-popup-id="${id}"]`).addClass('popup-open');
      document.querySelector('body').classList.add('popup-enabled');
    }

    function closeAll(e) {
      if (e.target.attributes['data-popup-close']) {
        document.querySelectorAll('.popup-open').forEach(el => {
          el.classList.remove('popup-open')
        });
        document.querySelector('body').classList.remove('popup-enabled');
      }
      try {
        let popupCloseEvent = new Event('wmPopupClosed');
        window.dispatchEvent(popupCloseEvent);
      } catch {
        console.log(`couldn't send custom Close Event`)
      }
    }

    function buildHTML(id, content) {
      let baseHTML = `<div data-will aria-hidden="true" class="wm-popup" data-popup-id="${id}">
    <div tabindex="-1" data-popup-close class="wm-popup-background">
      <div role="dialog" aria-modal="true" class="wm-popup-container">
        <button aria-label="Close popup" data-popup-close class="wm-popup-close-btn">×</button>
        <div class="wm-popup-content">
        </div>
      </div>
    </div>
  </div>`;
      $('#siteWrapper').append(baseHTML);
      let $popup = $(`[data-popup-id="${id}"]`),
          contentEl = $popup.find('.wm-popup-content');
      contentEl.append(content);
      /*Set Close Buttons*/
      $popup.find('[data-popup-close]').each(function(){
        $(this).on('click', closeAll);
      })
    }
  }

  let initPopups = () => {
    let popupBtns = document.querySelectorAll('a[href*="#wmpopup"], a[href*="#wm-popup"], a[href*="/wmpopup="], a[href*="/wm-popup="]');
    if (popupBtns.length) {
      popupBtns.forEach(btn => buildSQSPopupHTML(btn));

      let cssEl = document.querySelector('#wm-popups-css')
      if (!cssEl) {
        addCSS();
      } else {
        document.getElementsByTagName('head')[0].prepend(cssEl);
        let event = new Event('wmPopupsCSSLoaded');
        window.dispatchEvent(event);
        document.querySelector('body').classList.add('wm-popups-css-loaded')
      }
      window.dispatchEvent(new Event('wmPopupBuildComplete'));
    }
  }
  $(function() {
    initPopups();
  })
  window.initWMPopups = initPopups;


  function addCSS() {
    let url = 'https://assets.codepen.io/3198845/WMPopup210816v2.0.5.css';
    addCSSFileToHeader(url);
    function addCSSFileToHeader(url) {
      let head = document.getElementsByTagName('head')[0],
          link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'wm-popups-css'
      link.type = 'text/css';
      link.href = url;
      link.onload = function(){
        let event = new Event('wmPopupsCSSLoaded');
        window.dispatchEvent(event);
        document.querySelector('body').classList.add('wm-popups-css-loaded')
      };
      head.prepend(link);
    };
  }
}());
