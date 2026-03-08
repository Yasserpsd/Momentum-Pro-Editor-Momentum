(function($) {
    'use strict';

    var EDITOR_ONLY_STYLES = [
        'outline',
        'outline-offset',
        '-webkit-tap-highlight-color'
    ];

    function cleanEditorStyles(style) {
        if (!style) return '';
        var props = style.split(';').map(function(p) { return p.trim(); }).filter(Boolean);
        var clean = [];
        for (var i = 0; i < props.length; i++) {
            var propName = props[i].split(':')[0].trim().toLowerCase();
            var isEditorProp = false;
            for (var j = 0; j < EDITOR_ONLY_STYLES.length; j++) {
                if (propName === EDITOR_ONLY_STYLES[j]) {
                    isEditorProp = true;
                    break;
                }
            }
            if (propName === 'cursor' && props[i].toLowerCase().indexOf('text') !== -1) {
                isEditorProp = true;
            }
            if (!isEditorProp) {
                clean.push(props[i]);
            }
        }
        return clean.join('; ');
    }

    function extractCleanHtml($widget) {
        var $clone = $widget.clone();

        $clone.find('.m-badge, #m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar, .m-resize-h, .m-notify').remove();
        $clone.find('style.momentum-custom-css, style.momentum-responsive-css').remove();

        $clone.find('*').addBack().each(function() {
            var el = this;
            el.removeAttribute('contenteditable');

            var attrsToRemove = [];
            for (var i = 0; i < el.attributes.length; i++) {
                var name = el.attributes[i].name;
                if (name.indexOf('data-m4-') === 0 ||
                    name.indexOf('data-m-') === 0 ||
                    name === 'data-m3' ||
                    name === 'data-m4-init' ||
                    name === 'data-auto-sync') {
                    attrsToRemove.push(name);
                }
            }
            for (var j = 0; j < attrsToRemove.length; j++) {
                el.removeAttribute(attrsToRemove[j]);
            }

            var style = el.getAttribute('style');
            if (style) {
                var cs = el === $clone[0] ? '' : cleanEditorStyles(style);
                if (cs) el.setAttribute('style', cs);
                else el.removeAttribute('style');
            }

            var classes = el.getAttribute('class');
            if (classes) {
                classes = classes
                    .replace(/\bmomentum-editable\b/g, '')
                    .replace(/\bmomentum-html-output\b/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (classes) el.setAttribute('class', classes);
                else el.removeAttribute('class');
            }
        });

        $clone.removeAttr('data-widget-id');
        return $clone.html();
    }

    /* ============================================
       MAIN ENGINE
       ============================================ */
    var M = {
        ready: false,
        setupRunning: false,
        retryCount: 0,
        maxRetries: 30,
        _observer: null,
        _rescanTimer: null,
        _$toolbar: null,
        _toolbarTarget: null,
        _autoSyncTimers: {},
        _savedSelection: null,

        init: function() {
            if (this.ready) return;

            var isEditor = false;
            try {
                isEditor = $('body').hasClass('elementor-editor-active')
                    || $('body').hasClass('elementor-page')
                    || (typeof elementorFrontend !== 'undefined'
                        && typeof elementorFrontend.isEditMode === 'function'
                        && elementorFrontend.isEditMode());
            } catch(e) {}

            if (!isEditor) return;

            this.ready = true;
            this.setup();
            this.watchDOM();
            this.listenMessages();
            this.setupKeyboardShortcuts();
            console.log('[Momentum] Parser: Active v6.0');
        },

        tryInit: function() {
            var self = this;
            if (self.ready) return;
            try {
                if ($('.momentum-html-output.momentum-editable').length > 0) {
                    self.init();
                } else if (self.retryCount < self.maxRetries) {
                    self.retryCount++;
                    setTimeout(function() { self.tryInit(); }, 500);
                }
            } catch(e) {}
        },

        /* --- Selection Save/Restore --- */
        saveSelection: function() {
            var sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                this._savedSelection = sel.getRangeAt(0).cloneRange();
            }
        },

        restoreSelection: function() {
            if (this._savedSelection) {
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(this._savedSelection);
            }
        },

        clearSavedSelection: function() {
            this._savedSelection = null;
        },

        /* --- Keyboard --- */
        setupKeyboardShortcuts: function() {
            var self = this;
            $(document).on('keydown.m6', function(e) {
                if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                    var $focused = $('[contenteditable="true"]:focus');
                    if ($focused.length && $focused.closest('.momentum-html-output').length) {
                        return;
                    }
                }
                if (e.key === 'Escape') {
                    self.hideToolbar();
                    $('#m-link-editor').remove();
                    $('.m-img-bar, .m-box-bar').remove();
                    $('[data-m4-isel]').removeData('m4-isel').css('outline', 'none');
                    $('[data-m4-bsel]').removeData('m4-bsel').css('outline', 'none');
                }
            });
        },

        /* --- Messages --- */
        listenMessages: function() {
            var self = this;
            window.addEventListener('message', function(e) {
                if (!e.data) return;
                try {
                    switch (e.data.type) {
                        case 'momentum-get-html':
                            self.sendCleanHtml(e.data.widgetId);
                            break;
                        case 'momentum-code-synced':
                            self.notify('\u2705 \u062A\u0645 \u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0643\u0648\u062F!');
                            break;
                        case 'momentum-reset':
                            self.handleReset(e.data.widgetId);
                            break;
                    }
                } catch(err) {
                    console.error('[Momentum] Message handler error:', err);
                }
            });
        },

        sendCleanHtml: function(widgetId) {
            try {
                var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
                if (!$w.length) return;

                var html = extractCleanHtml($w);

                if (!html || !html.trim()) {
                    this.notify('\u26A0\uFE0F \u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u062D\u062A\u0648\u0649');
                    return;
                }

                window.parent.postMessage({
                    type: 'momentum-request-sync',
                    widgetId: widgetId,
                    html: html
                }, '*');

                console.log('[Momentum] Clean HTML sent, length:', html.length);
            } catch(err) {
                console.error('[Momentum] sendCleanHtml error:', err);
                this.notify('\u274C \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629');
            }
        },

        handleReset: function(widgetId) {
            try {
                var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
                if ($w.length) {
                    $w.removeData('m4-init');
                    setTimeout(function() { M.setup(); }, 500);
                }
            } catch(e) {}
        },

        /* --- Auto-Sync Every 5s --- */
        startAutoSync: function($w, wid) {
            var self = this;
            if (self._autoSyncTimers[wid]) return;

            self._autoSyncTimers[wid] = setInterval(function() {
                try {
                    var $widget = $('.momentum-html-output[data-widget-id="' + wid + '"]');
                    if (!$widget.length || $widget.attr('data-auto-sync') !== '1') {
                        clearInterval(self._autoSyncTimers[wid]);
                        delete self._autoSyncTimers[wid];
                        return;
                    }

                    var html = extractCleanHtml($widget);

                    if (html && html.trim()) {
                        window.parent.postMessage({
                            type: 'momentum-auto-sync-tick',
                            widgetId: wid,
                            html: html
                        }, '*');
                    }
                } catch(e) {
                    console.warn('[Momentum] Auto-sync tick error:', e);
                }
            }, 5000);
        },

        /* --- DOM Watcher --- */
        watchDOM: function() {
            var self = this;
            if (this._observer) this._observer.disconnect();

            this._observer = new MutationObserver(function(mutations) {
                var dominated = false;
                try {
                    for (var i = 0; i < mutations.length; i++) {
                        var mutation = mutations[i];
                        if (mutation.target && $(mutation.target).closest('#m-toolbar, .m-badge, .m-img-bar, .m-box-bar, .m-notify, #m-link-editor').length) continue;

                        var added = mutation.addedNodes;
                        for (var j = 0; j < added.length; j++) {
                            var node = added[j];
                            if (node.nodeType === 1) {
                                var $node = $(node);
                                if ($node.hasClass('m-badge') || $node.hasClass('m-notify') ||
                                    $node.attr('id') === 'm-toolbar' || $node.attr('id') === 'm-link-editor' ||
                                    $node.hasClass('m-img-bar') || $node.hasClass('m-box-bar')) continue;

                                if ($node.hasClass('momentum-html-output') || $node.find('.momentum-html-output').length > 0) {
                                    dominated = true;
                                    break;
                                }
                            }
                        }
                        if (dominated) break;
                    }
                } catch(e) {}

                if (dominated) {
                    if (self._rescanTimer) clearTimeout(self._rescanTimer);
                    self._rescanTimer = setTimeout(function() { self.setup(); }, 600);
                }
            });

            this._observer.observe(document.body, { childList: true, subtree: true });
        },

        /* --- Setup Widgets --- */
        setup: function() {
            if (this.setupRunning) return;
            this.setupRunning = true;
            var self = this;

            try {
                $('.momentum-html-output.momentum-editable').each(function() {
                    var $w = $(this);
                    if ($w.data('m4-init')) return;
                    $w.data('m4-init', true);

                    var wid = $w.data('widget-id');
                    if (!wid) return;

                    console.log('[Momentum] Setting up widget:', wid);

                    try { self.makeEditable($w, wid); } catch(e) { console.warn('makeEditable error:', e); }
                    try { self.setupImages($w, wid); } catch(e) { console.warn('setupImages error:', e); }
                    try { self.setupLinks($w, wid); } catch(e) { console.warn('setupLinks error:', e); }
                    try { self.setupBoxes($w, wid); } catch(e) { console.warn('setupBoxes error:', e); }
                    try { self.addBadge($w); } catch(e) { console.warn('addBadge error:', e); }

                    if ($w.attr('data-auto-sync') === '1') {
                        self.startAutoSync($w, wid);
                    }
                });
            } catch(e) {
                console.error('[Momentum] Setup error:', e);
            } finally {
                self.setupRunning = false;
            }
        },

        /* --- Badge --- */
        addBadge: function($w) {
            if ($w.find('.m-badge').length) return;
            var $badge = $('<div class="m-badge">').css({
                position: 'absolute', top: '8px', right: '8px',
                background: 'linear-gradient(135deg,#6C63FF,#4CAF50)',
                color: '#fff', fontSize: '10px', fontWeight: '700',
                padding: '4px 12px', borderRadius: '20px', zIndex: 100,
                pointerEvents: 'none', fontFamily: 'sans-serif',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '4px'
            }).html('<svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.3)"/><text x="10" y="14" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">M</text></svg> Momentum Pro v6');
            $w.css('position', 'relative');
            $w.prepend($badge);
        },

        /* --- Make Text Editable (each element independent) --- */
        makeEditable: function($w, wid) {
            var self = this;
            var skip = [
                'script','style','svg','path','circle','rect','line','polygon',
                'polyline','ellipse','g','defs','clippath','use','symbol',
                'br','hr','img','input','select','textarea','video','audio',
                'canvas','iframe','object','embed','noscript','template'
            ];

            $w.find('*').each(function() {
                var el = this;
                var $el = $(this);
                var tag = (el.tagName || '').toLowerCase();

                if (!tag || skip.indexOf(tag) !== -1) return;
                if ($el.hasClass('m-badge')) return;
                if ($el.closest('#m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar').length) return;
                if ($el.data('m4-text')) return;
                if (self.isIcon(el)) return;

                var hasText = false;
                for (var i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim().length > 0) {
                        hasText = true;
                        break;
                    }
                }
                if (!hasText) return;

                $el.data('m4-text', true);
                $el.attr('contenteditable', 'true');
                $el.css({ cursor: 'text', outline: 'none' });

                if (tag === 'a') {
                    $el.on('click.m6', function(e) { e.preventDefault(); });
                }

                $el.on('mouseenter.m6', function(e) {
                    e.stopPropagation();
                    if (!$(this).is(':focus')) {
                        $(this).css({ outline: '2px dashed rgba(108,99,255,0.4)', outlineOffset: '2px' });
                    }
                }).on('mouseleave.m6', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css('outline', 'none');
                    }
                });

                $el.on('focus.m6', function(e) {
                    e.stopPropagation();
                    $(this).css({ outline: '2px solid #6C63FF', outlineOffset: '3px' });
                    self.showToolbar($(this), wid);
                });

                $el.on('blur.m6', function() {
                    var $this = $(this);
                    $this.css('outline', 'none');
                    setTimeout(function() {
                        if (!self.isToolbarActive()) {
                            self.hideToolbar();
                        }
                    }, 300);
                });
            });
        },

        isIcon: function(el) {
            var $el = $(el);
            var tag = (el.tagName || '').toLowerCase();
            if ((tag === 'svg' || tag === 'i') && $el.text().trim().length <= 1) return true;
            var cls = (el.className || '').toString();
            if (/\b(fa|fas|far|fab|fal|fad|dashicons|eicon|ti-|glyphicon|material-icons|icon)\b/i.test(cls)) return true;
            return false;
        },

        /* ============================================
           TOOLBAR
           ============================================ */
        isToolbarActive: function() {
            if (!this._$toolbar) return false;
            try {
                return this._$toolbar.is(':hover') || this._$toolbar.find(':focus').length > 0;
            } catch(e) { return false; }
        },

        showToolbar: function($el, wid) {
            var self = this;
            this.hideToolbar();
            this._toolbarTarget = $el;

            var off = $el.offset();

            var $bar = $('<div id="m-toolbar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 94) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px',
                padding: '8px 10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)',
                fontFamily: 'sans-serif', maxWidth: '640px'
            }).on('mousedown', function(e) {
                if (!$(e.target).is('input')) e.preventDefault();
            });

            var s = function() { return self.sep(); };

            // ===== ROW 1: Inline formatting =====
            var $row1 = $('<div>').css({ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' });

            var $bold = this.btn('B', 'Bold').css('fontWeight', 'bold');
            $bold.on('mousedown', function(e) { e.preventDefault(); document.execCommand('bold'); });

            var $italic = this.btn('I', 'Italic').css('fontStyle', 'italic');
            $italic.on('mousedown', function(e) { e.preventDefault(); document.execCommand('italic'); });

            var $underline = this.btn('U', 'Underline').css('textDecoration', 'underline');
            $underline.on('mousedown', function(e) { e.preventDefault(); document.execCommand('underline'); });

            var $strike = this.btn('S', 'Strike').css('textDecoration', 'line-through');
            $strike.on('mousedown', function(e) { e.preventDefault(); document.execCommand('strikeThrough'); });

            // Text Color
            var $tcLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('\u0644\u0648\u0646');
            var $tc = $('<input type="color">').val(self.rgbToHex($el.css('color') || '#333')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $tc.on('mousedown', function() { self.saveSelection(); });
            $tc.on('input', function() {
                var c = $(this).val();
                self.restoreSelection();
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                    document.execCommand('foreColor', false, c);
                } else {
                    $el.css('color', c);
                }
            });

            // BG Color
            var $bgLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('\u062E\u0644\u0641\u064A\u0629');
            var $bg = $('<input type="color">').val('#ffff00').css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bg.on('mousedown', function() { self.saveSelection(); });
            $bg.on('input', function() {
                var c = $(this).val();
                self.restoreSelection();
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                    document.execCommand('hiliteColor', false, c);
                } else {
                    $el.css('background-color', c);
                }
            });

            // Remove Format
            var $rf = this.btn('\u2715', '\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u062A\u0646\u0633\u064A\u0642').css({ color: '#e74c3c' });
            $rf.on('mousedown', function(e) { e.preventDefault(); document.execCommand('removeFormat'); });

            $row1.append($bold, $italic, $underline, $strike, s(), $tcLabel, $tc, s(), $bgLabel, $bg, s(), $rf);

            // ===== ROW 2: Block level + Link =====
            var $row2 = $('<div>').css({
                display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap',
                marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #333'
            });

            var align = $el.css('text-align') || 'right';
            var $aR = this.btn('\u21E2', '\u064A\u0645\u064A\u0646', align === 'right' || align === 'start');
            var $aC = this.btn('\u21D4', '\u0648\u0633\u0637', align === 'center');
            var $aL = this.btn('\u21E0', '\u064A\u0633\u0627\u0631', align === 'left' || align === 'end');

            [$aR, $aC, $aL].forEach(function($b, i) {
                var val = ['right', 'center', 'left'][i];
                $b.attr('data-al', val);
                $b.on('mousedown', function(e) {
                    e.preventDefault();
                    $el.css('text-align', val);
                    [$aR, $aC, $aL].forEach(function(x) { x.css('background', '#2a2a3e'); });
                    $(this).css('background', '#6C63FF');
                });
            });

            // Font Size
            var sz = parseInt($el.css('font-size')) || 16;
            var $szD = this.btn('\u2212', '\u062A\u0635\u063A\u064A\u0631');
            var $szL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '36px', textAlign: 'center', display: 'inline-block' }).text(sz + 'px');
            var $szU = this.btn('+', '\u062A\u0643\u0628\u064A\u0631');

            $szD.on('mousedown', function(e) {
                e.preventDefault();
                sz = Math.max(6, sz - 1);
                $el.css('font-size', sz + 'px');
                $szL.text(sz + 'px');
            });
            $szU.on('mousedown', function(e) {
                e.preventDefault();
                sz = Math.min(200, sz + 1);
                $el.css('font-size', sz + 'px');
                $szL.text(sz + 'px');
            });

            // Selection font size
            var $sszD = this.btn('A\u2193', '\u062A\u0635\u063A\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u062F');
            var $sszU = this.btn('A\u2191', '\u062A\u0643\u0628\u064A\u0631 \u0627\u0644\u0645\u062D\u062F\u062F');

            $sszD.on('mousedown', function(e) { e.preventDefault(); self.changeSelFontSize(-2); });
            $sszU.on('mousedown', function(e) { e.preventDefault(); self.changeSelFontSize(2); });

            // Line Height
            var lh = parseFloat($el.css('line-height')) / (parseInt($el.css('font-size')) || 16);
            lh = Math.round(lh * 10) / 10 || 1.5;
            var $lhD = this.btn('\u2195\u2212', '\u062A\u0642\u0644\u064A\u0644');
            var $lhL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '26px', textAlign: 'center', display: 'inline-block' }).text(lh.toFixed(1));
            var $lhU = this.btn('\u2195+', '\u0632\u064A\u0627\u062F\u0629');

            $lhD.on('mousedown', function(e) {
                e.preventDefault();
                lh = Math.max(0.5, Math.round((lh - 0.1) * 10) / 10);
                $el.css('line-height', lh);
                $lhL.text(lh.toFixed(1));
            });
            $lhU.on('mousedown', function(e) {
                e.preventDefault();
                lh = Math.min(5, Math.round((lh + 0.1) * 10) / 10);
                $el.css('line-height', lh);
                $lhL.text(lh.toFixed(1));
            });

            // Link button
            var $link = this.btn('\uD83D\uDD17', '\u0625\u0636\u0627\u0641\u0629 \u0631\u0627\u0628\u0637');
            $link.on('mousedown', function(e) {
                e.preventDefault();
                self.saveSelection();
                self.addLinkToSelection($el, wid);
            });

            // Tag label
            var tagName = ($el.prop('tagName') || '').toLowerCase();
            var $tagLabel = $('<span>').css({
                color: '#6C63FF', fontSize: '9px', fontFamily: 'monospace',
                background: 'rgba(108,99,255,0.15)', padding: '2px 6px',
                borderRadius: '4px', marginLeft: '4px'
            }).text(tagName);

            $row2.append($aR, $aC, $aL, s(), $szD, $szL, $szU, s(), $sszD, $sszU, s(), $lhD, $lhL, $lhU, s(), $link, $tagLabel);

            $bar.append($row1, $row2);
            $('body').append($bar);

            this._$toolbar = $bar;
            this.fixBarPos($bar, off, $el);
        },

        hideToolbar: function() {
            if (this._$toolbar) {
                this._$toolbar.remove();
                this._$toolbar = null;
            }
            this._toolbarTarget = null;
        },

        fixBarPos: function($bar, off, $el) {
            try {
                var barW = $bar.outerWidth();
                var winW = $(window).width();
                var winScroll = $(window).scrollTop();

                if (off.left + barW > winW - 10) {
                    $bar.css('left', Math.max(10, winW - barW - 10) + 'px');
                }
                var barTop = parseInt($bar.css('top'));
                if (barTop < winScroll + 5) {
                    $bar.css('top', (off.top + $el.outerHeight() + 8) + 'px');
                }
            } catch(e) {}
        },

        changeSelFontSize: function(delta) {
            try {
                var sel = window.getSelection();
                if (!sel || sel.rangeCount === 0) return;
                var range = sel.getRangeAt(0);

                if (range.collapsed) {
                    if (this._toolbarTarget) {
                        var sz = parseInt(this._toolbarTarget.css('font-size')) || 16;
                        this._toolbarTarget.css('font-size', Math.max(6, Math.min(200, sz + delta)) + 'px');
                    }
                    return;
                }

                var container = range.startContainer;
                if (container.nodeType === 3) container = container.parentNode;
                var currentSize = parseInt(window.getComputedStyle(container).fontSize) || 16;
                var newSize = Math.max(6, Math.min(200, currentSize + delta));

                document.execCommand('fontSize', false, '7');
                if (this._toolbarTarget) {
                    this._toolbarTarget.find('font[size="7"]').each(function() {
                        var $span = $('<span>').css('font-size', newSize + 'px').html($(this).html());
                        $(this).replaceWith($span);
                    });
                }
            } catch(e) {
                console.warn('[Momentum] changeSelFontSize error:', e);
            }
        },

        /* ============================================
           LINK TO SELECTION
           ============================================ */
        addLinkToSelection: function($el, wid) {
            var self = this;

            if ($el.is('a')) {
                self.showLinkPopup($el, wid);
                return;
            }

            var text = '';
            if (self._savedSelection && !self._savedSelection.collapsed) {
                text = self._savedSelection.toString().trim();
            } else {
                var sel = window.getSelection();
                if (sel) text = sel.toString().trim();
            }

            if (!text) {
                self.notify('\u26A0\uFE0F \u062D\u062F\u062F \u0646\u0635 \u0623\u0648\u0644\u0627\u064B \u0639\u0634\u0627\u0646 \u062A\u0631\u0628\u0637\u0647 \u0628\u0631\u0627\u0628\u0637');
                return;
            }

            self.showLinkCreator($el, wid, text);
        },

        showLinkCreator: function($el, wid, selectedText) {
            var self = this;
            $('#m-link-editor').remove();

            var off = $el.offset();
            var inputStyle = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $el.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '320px', fontFamily: 'sans-serif'
            }).on('mousedown', function(e) { e.stopPropagation(); });

            $ed.html(
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">' +
                '<span style="color:#6C63FF;font-size:16px;">\uD83D\uDD17</span>' +
                '<span style="color:#6C63FF;font-weight:700;font-size:14px;">\u0625\u0636\u0627\u0641\u0629 \u0631\u0627\u0628\u0637</span>' +
                '</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u062D\u062F\u062F<div style="' + inputStyle + 'background:#1a1a2e;margin-top:4px;min-height:20px;padding:8px 12px;" id="ml-txt-display">' + self.escHtml(selectedText) + '</div></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="" placeholder="https://example.com" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">\u0644\u0648\u0646 \u0627\u0644\u0631\u0627\u0628\u0637<div style="display:flex;gap:8px;align-items:center;margin-top:4px;"><input type="color" id="ml-color" value="#6C63FF" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;background:transparent;padding:0;"><span id="ml-color-label" style="color:#fff;font-size:12px;">#6C63FF</span></div></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" checked> \u0641\u062A\u062D \u0641\u064A \u062A\u0627\u0628 \u062C\u062F\u064A\u062F</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">\u0625\u0644\u063A\u0627\u0621</button>' +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">\u0625\u0636\u0627\u0641\u0629</button>' +
                '</div>'
            );

            $('body').append($ed);

            $ed.find('#ml-color').on('input', function() {
                $ed.find('#ml-color-label').text($(this).val());
            });

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');
                var linkColor = $ed.find('#ml-color').val();

                if (!url) { self.notify('\u26A0\uFE0F \u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637'); return; }

                self.restoreSelection();

                var sel = window.getSelection();
                if (!sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
                    self.notify('\u26A0\uFE0F \u0641\u0642\u062F \u0627\u0644\u062A\u062D\u062F\u064A\u062F - \u062D\u062F\u062F \u0627\u0644\u0646\u0635 \u0645\u0631\u0629 \u062A\u0627\u0646\u064A\u0629');
                    $ed.remove();
                    return;
                }

                document.execCommand('createLink', false, url);

                $el.find('a[href="' + url + '"]').each(function() {
                    var $a = $(this);
                    if (bl) $a.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    if (linkColor) $a.css('color', linkColor);
                    $a.data('m4-link', true).on('dblclick.m6', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.showLinkPopup($(this), wid);
                    });
                });

                $ed.remove();
                self.clearSavedSelection();
                self.notify('\uD83D\uDD17 \u062A\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0631\u0627\u0628\u0637!');
            });

            $ed.find('#ml-x').on('click', function() {
                $ed.remove();
                self.clearSavedSelection();
            });

            $ed.find('#ml-url').on('keydown', function(e) {
                if (e.key === 'Enter') $ed.find('#ml-ok').trigger('click');
            });

            setTimeout(function() {
                try { $ed.find('#ml-url')[0].focus({ preventScroll: true }); } catch(e) {}
            }, 50);

            setTimeout(function() {
                $(document).on('click.mlink6', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        self.clearSavedSelection();
                        $(document).off('click.mlink6');
                    }
                });
            }, 200);
        },

        /* --- Links --- */
        setupLinks: function($w, wid) {
            var self = this;
            $w.find('a').each(function() {
                var $a = $(this);
                if ($a.data('m4-link')) return;
                $a.data('m4-link', true);
                $a.on('dblclick.m6', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.showLinkPopup($(this), wid);
                });
            });
        },

        showLinkPopup: function($el, wid) {
            var self = this;
            $('#m-link-editor').remove();

            var off = $el.offset();
            var inputStyle = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';
            var href = $el.is('a') ? ($el.attr('href') || '') : '';
            var txt = $el.text().trim();
            var blank = $el.is('a') ? ($el.attr('target') === '_blank') : true;

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $el.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '300px', fontFamily: 'sans-serif'
            }).on('mousedown', function(e) { e.stopPropagation(); });

            $ed.html(
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">' +
                '<span style="color:#6C63FF;font-size:16px;">\uD83D\uDD17</span>' +
                '<span style="color:#6C63FF;font-weight:700;font-size:14px;">\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0631\u0627\u0628\u0637</span>' +
                '</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="' + self.escAttr(href) + '" placeholder="https://example.com" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">\u0627\u0644\u0646\u0635<input type="text" id="ml-txt" value="' + self.escAttr(txt) + '" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" ' + (blank ? 'checked' : '') + '> \u0641\u062A\u062D \u0641\u064A \u062A\u0627\u0628 \u062C\u062F\u064A\u062F</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">\u0625\u0644\u063A\u0627\u0621</button>' +
                ($el.is('a') ? '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">\u062D\u0630\u0641</button>' : '') +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">\u062D\u0641\u0638</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var t = $ed.find('#ml-txt').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');
                if (!url) { self.notify('\u26A0\uFE0F \u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637'); return; }
                if ($el.is('a')) {
                    $el.attr('href', url);
                    var hasChildEls = false;
                    $el.children().each(function() { if (this.nodeType === 1) { hasChildEls = true; return false; } });
                    if (!hasChildEls && t) $el.text(t);
                    if (bl) $el.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    else $el.removeAttr('target').removeAttr('rel');
                }
                $ed.remove();
                self.notify('\uD83D\uDD17 \u062A\u0645 \u0627\u0644\u062D\u0641\u0638!');
            });

            if ($el.is('a')) {
                $ed.find('#ml-del').on('click', function() {
                    $el.replaceWith($el.text());
                    $ed.remove();
                    self.notify('\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0631\u0627\u0628\u0637');
                });
            }

            $ed.find('#ml-x').on('click', function() { $ed.remove(); });

            $ed.find('#ml-url, #ml-txt').on('keydown', function(e) {
                if (e.key === 'Enter') $ed.find('#ml-ok').trigger('click');
            });

            setTimeout(function() {
                $(document).on('click.mlink6', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        $(document).off('click.mlink6');
                    }
                });
            }, 200);
        },

        /* ============================================
           IMAGES
           ============================================ */
        setupImages: function($w, wid) {
            var self = this;
            $w.find('img').each(function() {
                var $img = $(this);
                if ($img.data('m4-img')) return;
                $img.data('m4-img', true);

                $img.attr('contenteditable', 'false');
                $img.css({ cursor: 'pointer', transition: 'outline 0.15s' });

                $img.on('mouseenter.m6', function() {
                    if (!$(this).data('m4-isel')) {
                        $(this).css({ outline: '3px solid rgba(108,99,255,0.5)', outlineOffset: '3px' });
                    }
                }).on('mouseleave.m6', function() {
                    if (!$(this).data('m4-isel')) $(this).css('outline', 'none');
                });

                $img.on('click.m6', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    try { window.getSelection().removeAllRanges(); } catch(ex) {}
                    self.selectImg($(this), wid);
                });
            });
        },

        selectImg: function($img, wid) {
            var self = this;

            $('[data-m4-isel]').removeData('m4-isel').css('outline', 'none');
            $('.m-img-bar, .m-resize-h').remove();
            this.hideToolbar();

            $img.data('m4-isel', true);
            $img.css({ outline: '3px solid #6C63FF', outlineOffset: '3px' });

            var off = $img.offset(), w = $img.width(), h = $img.height(), ratio = w / h;
            var s = function() { return self.sep(); };

            var $bar = $('<div class="m-img-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 42) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            // Replace
            var $rep = this.btn('\uD83D\uDCF7', '\u0627\u0633\u062A\u0628\u062F\u0627\u0644');
            $rep.on('mousedown', function(e) {
                e.preventDefault();
                try {
                    var frame = wp.media({ title: '\u0627\u062E\u062A\u0631 \u0635\u0648\u0631\u0629', multiple: false, library: { type: 'image' } });
                    frame.on('select', function() {
                        var att = frame.state().get('selection').first().toJSON();
                        $img.attr('src', att.url);
                        self.notify('\u2705 \u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0635\u0648\u0631\u0629!');
                    });
                    frame.open();
                } catch(e) {
                    self.notify('\u274C \u062E\u0637\u0623 \u0641\u064A \u0641\u062A\u062D \u0645\u0643\u062A\u0628\u0629 \u0627\u0644\u0648\u0633\u0627\u0626\u0637');
                }
            });

            // Width
            var $wD = this.btn('\u2212', '\u0623\u0635\u063A\u0631');
            var $wL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(Math.round(w));
            var $wU = this.btn('+', '\u0623\u0643\u0628\u0631');

            $wD.on('mousedown', function(e) {
                e.preventDefault();
                w = Math.max(30, w - 10); h = Math.round(w / ratio);
                $img.css({ width: w + 'px', height: h + 'px' }).attr({ width: Math.round(w), height: Math.round(h) });
                $wL.text(Math.round(w));
            });
            $wU.on('mousedown', function(e) {
                e.preventDefault();
                w += 10; h = Math.round(w / ratio);
                $img.css({ width: w + 'px', height: h + 'px' }).attr({ width: Math.round(w), height: Math.round(h) });
                $wL.text(Math.round(w));
            });

            // Border Radius
            var br = parseInt($img.css('border-radius')) || 0;
            var $brD = this.btn('\u25FB', '\u0623\u0642\u0644');
            var $brL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '22px', textAlign: 'center', display: 'inline-block' }).text(br);
            var $brU = this.btn('\u25EF', '\u0623\u0643\u062B\u0631');

            $brD.on('mousedown', function(e) { e.preventDefault(); br = Math.max(0, br - 4); $img.css('border-radius', br + 'px'); $brL.text(br); });
            $brU.on('mousedown', function(e) { e.preventDefault(); br += 4; $img.css('border-radius', br + 'px'); $brL.text(br); });

            // Image link
            var $imgLink = this.btn('\uD83D\uDD17', '\u0631\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629 \u0628\u0631\u0627\u0628\u0637');
            $imgLink.on('mousedown', function(e) {
                e.preventDefault();
                self.showImageLinkPopup($img, wid);
            });

            $bar.append($rep, s(), $wD, $wL, $wU, s(), $brD, $brL, $brU, s(), $imgLink);
            $('body').append($bar);

            setTimeout(function() {
                $(document).on('click.mimg6', function(e) {
                    if (!$(e.target).closest('.m-img-bar').length && !$(e.target).is($img[0])) {
                        $img.removeData('m4-isel').css('outline', 'none');
                        $('.m-img-bar').remove();
                        $(document).off('click.mimg6');
                    }
                });
            }, 100);
        },

        showImageLinkPopup: function($img, wid) {
            var self = this;
            $('#m-link-editor').remove();

            var $parent = $img.parent();
            var isLinked = $parent.is('a');
            var currentHref = isLinked ? ($parent.attr('href') || '') : '';

            var off = $img.offset();
            var inputStyle = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $img.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '300px', fontFamily: 'sans-serif'
            }).on('mousedown', function(e) { e.stopPropagation(); });

            $ed.html(
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">' +
                '<span style="color:#6C63FF;font-size:16px;">\uD83D\uDD17</span>' +
                '<span style="color:#6C63FF;font-weight:700;font-size:14px;">' + (isLinked ? '\u062A\u0639\u062F\u064A\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629' : '\u0631\u0628\u0637 \u0627\u0644\u0635\u0648\u0631\u0629 \u0628\u0631\u0627\u0628\u0637') + '</span>' +
                '</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="' + self.escAttr(currentHref) + '" placeholder="https://example.com" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" checked> \u0641\u062A\u062D \u0641\u064A \u062A\u0627\u0628 \u062C\u062F\u064A\u062F</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">\u0625\u0644\u063A\u0627\u0621</button>' +
                (isLinked ? '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">\u062D\u0630\u0641</button>' : '') +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">\u062D\u0641\u0638</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');
                if (!url) { self.notify('\u26A0\uFE0F \u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637'); return; }

                if (isLinked) {
                    $parent.attr('href', url);
                    if (bl) $parent.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    else $parent.removeAttr('target').removeAttr('rel');
                } else {
                    var $a = $('<a>').attr('href', url);
                    if (bl) $a.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    $img.wrap($a);
                }

                $ed.remove();
                self.notify('\uD83D\uDD17 \u062A\u0645 \u0627\u0644\u062D\u0641\u0638!');
            });

            if (isLinked) {
                $ed.find('#ml-del').on('click', function() {
                    $img.unwrap('a');
                    $ed.remove();
                    self.notify('\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0631\u0627\u0628\u0637');
                });
            }

            $ed.find('#ml-x').on('click', function() { $ed.remove(); });
            $ed.find('#ml-url').on('keydown', function(e) {
                if (e.key === 'Enter') $ed.find('#ml-ok').trigger('click');
            });

            setTimeout(function() {
                $(document).on('click.mlink6', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        $(document).off('click.mlink6');
                    }
                });
            }, 200);
        },

        /* ============================================
           BOXES (div, section) - Right-click menu
           ============================================ */
        setupBoxes: function($w, wid) {
            var self = this;
            $w.find('div, section').each(function() {
                var $box = $(this);
                if ($box.hasClass('momentum-html-output') || $box.hasClass('m-badge') || $box.hasClass('m-notify')) return;
                if ($box.data('m4-box')) return;
                $box.data('m4-box', true);

                $box.on('contextmenu.m6', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.selectBox($(this), wid, e);
                });
            });
        },

        selectBox: function($box, wid, e) {
            var self = this;

            $('[data-m4-bsel]').removeData('m4-bsel').css('outline', 'none');
            $('.m-box-bar').remove();

            $box.data('m4-bsel', true);
            $box.css({ outline: '2px solid #4CAF50', outlineOffset: '2px' });

            var $bar = $('<div class="m-box-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: (e.pageY + 5) + 'px', left: (e.pageX + 5) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(76,175,80,0.3)',
                fontFamily: 'sans-serif', minWidth: '200px'
            }).on('mousedown', function(e) { e.stopPropagation(); });

            var mItem = function(label, icon, fn) {
                return $('<div>').css({
                    color: '#fff', fontSize: '12px', padding: '6px 10px',
                    borderRadius: '6px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '8px', transition: 'background 0.15s'
                }).html('<span style="font-size:14px;">' + icon + '</span> ' + label)
                .on('mouseenter', function() { $(this).css('background', '#2a2a3e'); })
                .on('mouseleave', function() { $(this).css('background', 'transparent'); })
                .on('click', function() { fn(); $bar.remove(); $box.removeData('m4-bsel').css('outline', 'none'); });
            };

            $bar.append(mItem('\u0644\u0648\u0646 \u0627\u0644\u062E\u0644\u0641\u064A\u0629', '\uD83C\uDFA8', function() {
                var $input = $('<input type="color" value="' + (self.rgbToHex($box.css('background-color') || '#ffffff')) + '">').css({ position: 'fixed', top: '-100px' });
                $('body').append($input);
                $input.on('input', function() { $box.css('background-color', $(this).val()); });
                $input.on('change', function() { $(this).remove(); });
                $input[0].click();
            }));

            $bar.append(mItem('\u0632\u064A\u0627\u062F\u0629 \u0627\u0644\u0645\u0633\u0627\u0641\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629', '\u2B1C', function() {
                var p = parseInt($box.css('padding')) || 0;
                $box.css('padding', (p + 10) + 'px');
            }));

            $bar.append(mItem('\u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u0645\u0633\u0627\u0641\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629', '\uD83D\uDD32', function() {
                var p = parseInt($box.css('padding')) || 0;
                $box.css('padding', Math.max(0, p - 10) + 'px');
            }));

            $bar.append(mItem('\u062D\u0648\u0627\u0641 \u062F\u0627\u0626\u0631\u064A\u0629', '\u25EF', function() {
                var br = parseInt($box.css('border-radius')) || 0;
                $box.css('border-radius', (br + 8) + 'px');
            }));

            $bar.append(mItem('\u0625\u0636\u0627\u0641\u0629 \u0628\u0648\u0631\u062F\u0631', '\uD83D\uDD33', function() {
                $box.css('border', '1px solid #ddd');
            }));

            $bar.append(mItem('\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0628\u0648\u0631\u062F\u0631', '\u2715', function() {
                $box.css('border', 'none');
            }));

            var tag = ($box.prop('tagName') || '').toLowerCase();
            $bar.append($('<div>').css({
                color: '#4CAF50', fontSize: '9px', fontFamily: 'monospace',
                textAlign: 'center', padding: '4px', marginTop: '4px',
                borderTop: '1px solid #333'
            }).text('<' + tag + '>'));

            $('body').append($bar);

            setTimeout(function() {
                $(document).on('click.mbox6', function(e) {
                    if (!$(e.target).closest('.m-box-bar').length) {
                        $box.removeData('m4-bsel').css('outline', 'none');
                        $('.m-box-bar').remove();
                        $(document).off('click.mbox6');
                    }
                });
            }, 100);
        },

        /* ============================================
           UTILITY FUNCTIONS
           ============================================ */
        btn: function(label, title, active) {
            var bg = active ? '#6C63FF' : '#2a2a3e';
            return $('<span>').css({
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '26px', height: '24px', background: bg,
                color: '#fff', fontSize: '11px', borderRadius: '4px',
                cursor: 'pointer', padding: '0 4px', transition: 'background 0.15s',
                userSelect: 'none', fontFamily: 'sans-serif'
            }).text(label).attr('title', title || '')
            .on('mouseenter', function() {
                if (!active) $(this).css('background', '#3a3a5e');
            }).on('mouseleave', function() {
                if (!active) $(this).css('background', bg);
            });
        },

        sep: function() {
            return $('<span>').css({
                width: '1px', height: '18px', background: '#333',
                display: 'inline-block', margin: '0 2px'
            });
        },

        notify: function(msg) {
            $('.m-notify').remove();
            var $n = $('<div class="m-notify">').css({
                position: 'fixed', bottom: '20px', left: '50%',
                transform: 'translateX(-50%)', background: '#1a1a2e',
                color: '#fff', padding: '10px 20px', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'sans-serif', zIndex: 999999,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)'
            }).text(msg);
            $('body').append($n);
            setTimeout(function() { $n.fadeOut(300, function() { $(this).remove(); }); }, 2500);
        },

        rgbToHex: function(rgb) {
            if (!rgb) return '#333333';
            if (rgb.charAt(0) === '#') return rgb;
            try {
                var parts = rgb.match(/\d+/g);
                if (!parts || parts.length < 3) return '#333333';
                var hex = '#';
                for (var i = 0; i < 3; i++) {
                    hex += ('0' + parseInt(parts[i]).toString(16)).slice(-2);
                }
                return hex;
            } catch(e) { return '#333333'; }
        },

        escAttr: function(str) {
            return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        escHtml: function(str) {
            return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    };

    /* ============================================
       BOOTSTRAP
       ============================================ */
    $(document).ready(function() {
        M.tryInit();
    });

    $(window).on('elementor/frontend/init', function() {
        if (typeof elementorFrontend !== 'undefined' && typeof elementorFrontend.hooks !== 'undefined') {
            elementorFrontend.hooks.addAction('frontend/element_ready/momentum_html_pro.default', function() {
                setTimeout(function() { M.setup(); }, 500);
            });
        }
    });

    setTimeout(function() { M.tryInit(); }, 2000);
    setTimeout(function() { M.tryInit(); }, 5000);

})(jQuery);
