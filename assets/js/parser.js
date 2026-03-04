(function($) {
    'use strict';

    // ============================================
    // EDITOR-ONLY STYLE PROPERTIES
    // These are the ONLY CSS properties we add during editing
    // and the ONLY ones we remove during sync
    // ============================================
    var EDITOR_ONLY_STYLES = [
        'outline',
        'outline-offset',
        '-webkit-tap-highlight-color'
    ];

    // cursor:text is the only cursor value we inject
    var EDITOR_CURSOR_VALUE = 'text';

    var M = {
        ready: false,
        setupRunning: false,
        retryCount: 0,
        maxRetries: 30,
        _observer: null,
        _rescanTimer: null,
        _$toolbar: null,
        _toolbarTarget: null,

        // ============================================
        // INITIALIZATION
        // ============================================
        init: function() {
            if (this.ready) return;

            var isEditor = $('body').hasClass('elementor-editor-active')
                        || $('body').hasClass('elementor-page')
                        || (typeof elementorFrontend !== 'undefined'
                            && typeof elementorFrontend.isEditMode === 'function'
                            && elementorFrontend.isEditMode());

            if (!isEditor) return;

            this.ready = true;
            this.setup();
            this.watchDOM();
            this.listenMessages();
            console.log('[Momentum] Parser: Active v4.1');
        },

        tryInit: function() {
            var self = this;
            if (self.ready) return;

            var $widgets = $('.momentum-html-output.momentum-editable');
            if ($widgets.length > 0) {
                self.init();
            } else if (self.retryCount < self.maxRetries) {
                self.retryCount++;
                setTimeout(function() { self.tryInit(); }, 500);
            }
        },

        // ============================================
        // MESSAGE LISTENERS
        // ============================================
        listenMessages: function() {
            var self = this;
            window.addEventListener('message', function(e) {
                if (!e.data) return;

                switch (e.data.type) {
                    case 'momentum-get-html':
                        self.sendCleanHtml(e.data.widgetId);
                        break;
                    case 'momentum-code-synced':
                        self.notify('✅ تم مزامنة الكود!');
                        break;
                    case 'momentum-reset':
                        self.handleReset(e.data.widgetId);
                        break;
                }
            });
        },

        /**
         * SAFE HTML EXTRACTION
         * This is the critical function that was causing the bug.
         * We now carefully preserve all user styles.
         */
        sendCleanHtml: function(widgetId) {
            var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
            if (!$w.length) {
                console.warn('[Momentum] Widget not found for sync:', widgetId);
                return;
            }

            // Deep clone the widget
            var $clone = $w.clone();

            // 1. Remove editor UI elements (badges, toolbars, etc.)
            $clone.find('.m-badge, #m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar, .m-resize-h, .m-notify').remove();

            // 2. Remove the custom CSS <style> tag (it's managed by Elementor control)
            $clone.find('style.momentum-custom-css').remove();

            // 3. Clean each element
            $clone.find('*').addBack().each(function() {
                var el = this;

                // Remove contenteditable
                el.removeAttribute('contenteditable');

                // Remove data-m4-* and data-m-* attributes ONLY
                var attrsToRemove = [];
                for (var i = 0; i < el.attributes.length; i++) {
                    var name = el.attributes[i].name;
                    if (name.indexOf('data-m4-') === 0 ||
                        name.indexOf('data-m-') === 0 ||
                        name === 'data-m3' ||
                        name === 'data-m4-init') {
                        attrsToRemove.push(name);
                    }
                }
                for (var j = 0; j < attrsToRemove.length; j++) {
                    el.removeAttribute(attrsToRemove[j]);
                }

                // Clean ONLY editor-injected styles, preserve everything else
                var style = el.getAttribute('style');
                if (style) {
                    var cleanStyle = this === $clone[0]
                        ? '' // Remove all styles from the wrapper div itself
                        : cleanEditorStyles(style);

                    if (cleanStyle) {
                        el.setAttribute('style', cleanStyle);
                    } else {
                        el.removeAttribute('style');
                    }
                }

                // Remove momentum-editable and momentum-html-output classes
                var classes = el.getAttribute('class');
                if (classes) {
                    classes = classes
                        .replace(/\bmomentum-editable\b/g, '')
                        .replace(/\bmomentum-html-output\b/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (classes) {
                        el.setAttribute('class', classes);
                    } else {
                        el.removeAttribute('class');
                    }
                }
            });

            // 4. Remove data-widget-id from the wrapper
            $clone.removeAttr('data-widget-id');

            // 5. Get the INNER HTML (not including the wrapper div)
            var html = $clone.html();

            if (!html || !html.trim()) {
                console.warn('[Momentum] Empty HTML after cleaning');
                return;
            }

            // Send to panel for saving
            window.parent.postMessage({
                type: 'momentum-request-sync',
                widgetId: widgetId,
                html: html
            }, '*');

            console.log('[Momentum] Clean HTML sent, length:', html.length);
        },

        handleReset: function(widgetId) {
            var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
            if ($w.length) {
                $w.removeData('m4-init');
                setTimeout(function() { M.setup(); }, 500);
            }
        },

        // ============================================
        // DOM WATCHER
        // ============================================
        watchDOM: function() {
            var self = this;

            if (this._observer) {
                this._observer.disconnect();
            }

            this._observer = new MutationObserver(function(mutations) {
                var dominated = false;
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    for (var j = 0; j < added.length; j++) {
                        var node = added[j];
                        if (node.nodeType === 1) {
                            if ($(node).hasClass('momentum-html-output') ||
                                $(node).find('.momentum-html-output').length > 0) {
                                dominated = true;
                                break;
                            }
                        }
                    }
                    if (dominated) break;
                }

                if (dominated) {
                    if (self._rescanTimer) clearTimeout(self._rescanTimer);
                    self._rescanTimer = setTimeout(function() {
                        self.setup();
                    }, 400);
                }
            });

            this._observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        // ============================================
        // SETUP WIDGETS
        // ============================================
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

                    self.makeEditable($w, wid);
                    self.setupImages($w, wid);
                    self.setupLinks($w, wid);
                    self.setupBoxes($w, wid);
                    self.addBadge($w);
                });
            } finally {
                self.setupRunning = false;
            }
        },

        // ============================================
        // BADGE
        // ============================================
        addBadge: function($w) {
            if ($w.find('.m-badge').length) return;
            var $badge = $('<div class="m-badge">').css({
                position: 'absolute', top: '8px', right: '8px',
                background: 'linear-gradient(135deg,#6C63FF,#4CAF50)',
                color: '#fff', fontSize: '10px', fontWeight: '700',
                padding: '4px 10px', borderRadius: '20px', zIndex: 100,
                pointerEvents: 'none', fontFamily: 'sans-serif',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }).text('Momentum Pro v4');
            $w.css('position', 'relative');
            $w.prepend($badge);
        },

        // ============================================
        // MAKE TEXT EDITABLE
        // ============================================
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
                    $el.on('click.m4', function(e) { e.preventDefault(); });
                }

                $el.on('mouseenter.m4', function(e) {
                    e.stopPropagation();
                    if (!$(this).is(':focus')) {
                        $(this).css({ outline: '2px dashed rgba(108,99,255,0.4)', outlineOffset: '2px' });
                    }
                }).on('mouseleave.m4', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css('outline', 'none');
                    }
                });

                $el.on('focus.m4', function(e) {
                    e.stopPropagation();
                    $(this).css({ outline: '2px solid #6C63FF', outlineOffset: '3px' });
                    self.showToolbar($(this), wid);
                });

                $el.on('blur.m4', function() {
                    var $this = $(this);
                    $this.css('outline', 'none');
                    setTimeout(function() {
                        if (!self.isToolbarHovered()) {
                            self.hideToolbar();
                        }
                    }, 250);
                });
            });
        },

        isIcon: function(el) {
            var $el = $(el);
            var tag = (el.tagName || '').toLowerCase();

            if (tag === 'svg' || tag === 'i') {
                if ($el.text().trim().length <= 1) return true;
            }

            var cls = (el.className || '').toString();
            if (/\b(fa|fas|far|fab|fal|fad|dashicons|eicon|ti-|glyphicon|material-icons|icon)\b/i.test(cls)) return true;

            return false;
        },

        // ============================================
        // TOOLBAR
        // ============================================
        isToolbarHovered: function() {
            if (!this._$toolbar) return false;
            return this._$toolbar.is(':hover') || this._$toolbar.find(':focus').length > 0;
        },

        showToolbar: function($el, wid) {
            var self = this;
            this.hideToolbar();

            this._toolbarTarget = $el;

            var off = $el.offset();

            var $bar = $('<div id="m-toolbar">').css({
                position: 'absolute',
                zIndex: 999999,
                top: Math.max(5, off.top - 94) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e',
                borderRadius: '12px',
                padding: '8px 10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)',
                fontFamily: 'sans-serif',
                maxWidth: '600px'
            }).on('mousedown', function(e) {
                if (!$(e.target).is('input')) {
                    e.preventDefault();
                }
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

            var $strike = this.btn('S', 'Strikethrough').css('textDecoration', 'line-through');
            $strike.on('mousedown', function(e) { e.preventDefault(); document.execCommand('strikeThrough'); });

            // Text Color
            var $tcLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('لون');
            var $tc = $('<input type="color">').val(self.rgbToHex($el.css('color') || '#333')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $tc.on('input', function() {
                var c = $(this).val();
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                    document.execCommand('foreColor', false, c);
                } else {
                    $el.css('color', c);
                }
            });

            // BG Color
            var $bgLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('خلفية');
            var $bg = $('<input type="color">').val('#ffff00').css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bg.on('input', function() {
                var c = $(this).val();
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
                    document.execCommand('hiliteColor', false, c);
                } else {
                    $el.css('background-color', c);
                }
            });

            // Remove Format
            var $rf = this.btn('✕', 'إزالة التنسيق').css({ color: '#e74c3c' });
            $rf.on('mousedown', function(e) { e.preventDefault(); document.execCommand('removeFormat'); });

            $row1.append($bold, $italic, $underline, $strike, s(), $tcLabel, $tc, s(), $bgLabel, $bg, s(), $rf);

            // ===== ROW 2: Block level =====
            var $row2 = $('<div>').css({
                display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap',
                marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #333'
            });

            // Align
            var align = $el.css('text-align') || 'right';
            var $aR = this.btn('⇢', 'يمين', align === 'right' || align === 'start');
            var $aC = this.btn('⇔', 'وسط', align === 'center');
            var $aL = this.btn('⇠', 'يسار', align === 'left' || align === 'end');

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

            // Font Size (whole element)
            var sz = parseInt($el.css('font-size')) || 16;
            var $szD = this.btn('−', 'تصغير');
            var $szL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '36px', textAlign: 'center', display: 'inline-block' }).text(sz + 'px');
            var $szU = this.btn('+', 'تكبير');

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
            var $sszD = this.btn('A↓', 'تصغير المحدد');
            var $sszU = this.btn('A↑', 'تكبير المحدد');

            $sszD.on('mousedown', function(e) { e.preventDefault(); self.changeSelFontSize(-2); });
            $sszU.on('mousedown', function(e) { e.preventDefault(); self.changeSelFontSize(2); });

            // Line Height
            var lh = parseFloat($el.css('line-height')) / (parseInt($el.css('font-size')) || 16);
            lh = Math.round(lh * 10) / 10 || 1.5;
            var $lhD = this.btn('↕−', 'تقليل');
            var $lhL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '26px', textAlign: 'center', display: 'inline-block' }).text(lh.toFixed(1));
            var $lhU = this.btn('↕+', 'زيادة');

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

            // Link
            var $link = this.btn('🔗', 'رابط');
            $link.on('mousedown', function(e) {
                e.preventDefault();
                self.addLinkToSelection($el, wid);
            });

            $row2.append($aR, $aC, $aL, s(), $szD, $szL, $szU, s(), $sszD, $sszU, s(), $lhD, $lhL, $lhU, s(), $link);

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
        },

        changeSelFontSize: function(delta) {
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

            // Use fontSize command with placeholder, then replace
            document.execCommand('fontSize', false, '7');
            if (this._toolbarTarget) {
                this._toolbarTarget.find('font[size="7"]').each(function() {
                    var $span = $('<span>').css('font-size', newSize + 'px').html($(this).html());
                    $(this).replaceWith($span);
                });
            }
        },

        addLinkToSelection: function($el, wid) {
            var self = this;

            if ($el.is('a')) {
                self.showLinkPopup($el, wid);
                return;
            }

            var sel = window.getSelection();
            var text = sel ? sel.toString().trim() : '';

            if (!text) {
                self.notify('⚠️ حدد نص أولاً');
                return;
            }

            var url = prompt('أدخل الرابط:', 'https://');
            if (!url) return;

            document.execCommand('createLink', false, url);
            $el.find('a[href="' + url + '"]').attr('target', '_blank').attr('rel', 'noopener noreferrer');
            self.notify('🔗 تم إضافة الرابط!');
        },

        // ============================================
        // LINKS
        // ============================================
        setupLinks: function($w, wid) {
            var self = this;
            $w.find('a').each(function() {
                var $a = $(this);
                if ($a.data('m4-link')) return;
                $a.data('m4-link', true);
                $a.on('dblclick.m4', function(e) {
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
            var is = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';
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
                '<div style="color:#6C63FF;font-weight:700;font-size:14px;margin-bottom:12px;">🔗 تعديل الرابط</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="' + self.escAttr(href) + '" placeholder="https://example.com" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص<input type="text" id="ml-txt" value="' + self.escAttr(txt) + '" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" ' + (blank ? 'checked' : '') + '> فتح في تاب جديد</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                ($el.is('a') ? '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">حذف</button>' : '') +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">حفظ</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var t = $ed.find('#ml-txt').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');

                if (!url) { alert('أدخل رابط'); return; }

                if ($el.is('a')) {
                    $el.attr('href', url);
                    var hasChildEls = false;
                    $el.children().each(function() { if (this.nodeType === 1) { hasChildEls = true; return false; } });
                    if (!hasChildEls && t) $el.text(t);
                    if (bl) { $el.attr('target', '_blank').attr('rel', 'noopener noreferrer'); }
                    else { $el.removeAttr('target').removeAttr('rel'); }
                }

                $ed.remove();
                self.notify('🔗 تم الحفظ!');
            });

            if ($el.is('a')) {
                $ed.find('#ml-del').on('click', function() {
                    $el.replaceWith($el.text());
                    $ed.remove();
                    self.notify('تم حذف الرابط');
                });
            }

            $ed.find('#ml-x').on('click', function() { $ed.remove(); });

            setTimeout(function() {
                $(document).on('click.mlink4', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        $(document).off('click.mlink4');
                    }
                });
            }, 100);
        },

        // ============================================
        // IMAGES (separate from text, no contenteditable)
        // ============================================
        setupImages: function($w, wid) {
            var self = this;
            $w.find('img').each(function() {
                var $img = $(this);
                if ($img.data('m4-img')) return;
                $img.data('m4-img', true);

                $img.attr('contenteditable', 'false');
                $img.css({ cursor: 'pointer', transition: 'outline 0.15s' });

                $img.on('mouseenter.m4', function() {
                    if (!$(this).data('m4-isel')) {
                        $(this).css({ outline: '3px solid rgba(108,99,255,0.5)', outlineOffset: '3px' });
                    }
                }).on('mouseleave.m4', function() {
                    if (!$(this).data('m4-isel')) {
                        $(this).css('outline', 'none');
                    }
                });

                $img.on('click.m4', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.getSelection().removeAllRanges();
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

            var $bar = $('<div class="m-img-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 42) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            var s = function() { return self.sep(); };

            // Replace
            var $rep = this.btn('📷', 'استبدال');
            $rep.on('mousedown', function(e) {
                e.preventDefault();
                var frame = wp.media({ title: 'اختر صورة', multiple: false, library: { type: 'image' } });
                frame.on('select', function() {
                    var att = frame.state().get('selection').first().toJSON();
                    $img.attr('src', att.url);
                    self.notify('✅ تم تغيير الصورة!');
                });
                frame.open();
            });

            // Width
            var $wD = this.btn('−', 'أصغر');
            var $wL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(Math.round(w));
            var $wU = this.btn('+', 'أكبر');

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
            var $brD = this.btn('◻', 'أقل');
            var $brL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '22px', textAlign: 'center', display: 'inline-block' }).text(br);
            var $brU = this.btn('◯', 'أكثر');

            $brD.on('mousedown', function(e) { e.preventDefault(); br = Math.max(0, br - 4); $img.css('border-radius', br + 'px'); $brL.text(br); });
            $brU.on('mousedown', function(e) { e.preventDefault(); br += 4; $img.css('border-radius', br + 'px'); $brL.text(br); });

            $bar.append($rep, s(), $wD, $wL, $wU, s(), $brD, $brL, $brU);
            $('body').append($bar);

            setTimeout(function() {
                $(document).on('click.mimg4', function(e) {
                    if (!$(e.target).closest('.m-img-bar').length && !$(e.target).is($img[0])) {
                        $img.removeData('m4-isel').css('outline', 'none');
                        $('.m-img-bar').remove();
                        $(document).off('click.mimg4');
                    }
                });
            }, 100);
        },

        // ============================================
        // BOX EDITING (right-click)
        // ============================================
        setupBoxes: function($w, wid) {
            var self = this;
            $w.find('div, section, article, header, footer, ul, ol, table, blockquote').each(function() {
                var $box = $(this);
                if ($box.data('m4-box')) return;
                if ($box.hasClass('momentum-html-output') || $box.hasClass('m-badge')) return;
                if ($box.closest('#m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar').length) return;
                $box.data('m4-box', true);

                $box.on('contextmenu.m4', function(e) {
                    if (e.target !== this && !$(e.target).is('div, section, article')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    self.showBoxBar($(this), wid);
                });

                $box.on('mouseenter.m4', function(e) {
                    e.stopPropagation();
                    if (!$(this).data('m4-bsel')) $(this).css({ outline: '1px dashed rgba(255,152,0,0.35)', outlineOffset: '1px' });
                }).on('mouseleave.m4', function() {
                    if (!$(this).data('m4-bsel')) $(this).css('outline', 'none');
                });
            });
        },

        showBoxBar: function($box, wid) {
            var self = this;
            this.hideToolbar();
            $('.m-box-bar, .m-img-bar').remove();

            $box.data('m4-bsel', true);
            $box.css({ outline: '2px solid #FF9800', outlineOffset: '2px' });
            var off = $box.offset();

            var $bar = $('<div class="m-box-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 48) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,152,0,0.4)',
                flexWrap: 'wrap', maxWidth: '480px'
            }).on('mousedown', function(e) { e.preventDefault(); });

            var tag = $box.prop('tagName').toLowerCase();
            var $label = $('<span>').css({ color: '#FF9800', fontSize: '11px', fontWeight: '600', padding: '0 6px', fontFamily: 'monospace' }).text(tag);
            var s = function() { return self.sep(); };

            var $dup = this.btn('⧉', 'نسخ');
            $dup.on('mousedown', function(e) {
                e.preventDefault();
                var $clone = $box.clone(true);
                $clone.find('*').addBack().removeData();
                $box.after($clone);
                setTimeout(function() {
                    var $w2 = $clone.closest('.momentum-html-output');
                    self.makeEditable($w2, wid);
                    self.setupImages($w2, wid);
                    self.setupLinks($w2, wid);
                    self.setupBoxes($w2, wid);
                }, 100);
                self.notify('تم النسخ');
            });

            var $del = this.btn('🗑', 'حذف').css('background', '#5c1a1a');
            $del.on('mousedown', function(e) {
                e.preventDefault();
                if (confirm('حذف هذا العنصر؟')) {
                    $box.fadeOut(200, function() { $(this).remove(); });
                    $('.m-box-bar').remove();
                    self.notify('تم الحذف');
                }
            });

            // Padding
            var pad = parseInt($box.css('padding-top')) || 0;
            var $pD = this.btn('P−', '-');
            var $pL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '24px', textAlign: 'center', display: 'inline-block' }).text(pad);
            var $pU = this.btn('P+', '+');

            $pD.on('mousedown', function(e) { e.preventDefault(); pad = Math.max(0, pad - 5); $box.css('padding', pad + 'px'); $pL.text(pad); });
            $pU.on('mousedown', function(e) { e.preventDefault(); pad += 5; $box.css('padding', pad + 'px'); $pL.text(pad); });

            // BG
            var $bgL = $('<span>').css({ color: '#aaa', fontSize: '10px' }).text('BG:');
            var $bgC = $('<input type="color">').val(self.rgbToHex($box.css('background-color') || '#fff')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent'
            });
            $bgC.on('input', function() { $box.css('background-color', $(this).val()); });

            // Border Radius
            var brd = parseInt($box.css('border-radius')) || 0;
            var $bD = this.btn('R−', '-');
            var $bL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '22px', textAlign: 'center', display: 'inline-block' }).text(brd);
            var $bU = this.btn('R+', '+');

            $bD.on('mousedown', function(e) { e.preventDefault(); brd = Math.max(0, brd - 2); $box.css('border-radius', brd + 'px'); $bL.text(brd); });
            $bU.on('mousedown', function(e) { e.preventDefault(); brd += 2; $box.css('border-radius', brd + 'px'); $bL.text(brd); });

            $bar.append($label, s(), $dup, $del, s(), $pD, $pL, $pU, s(), $bgL, $bgC, s(), $bD, $bL, $bU);
            $('body').append($bar);

            $(document).on('click.mbox4', function(e) {
                if (!$(e.target).closest('.m-box-bar').length && !$(e.target).is($box[0])) {
                    $box.removeData('m4-bsel').css('outline', 'none');
                    $('.m-box-bar').remove();
                    $(document).off('click.mbox4');
                }
            });
        },

        // ============================================
        // UTILITY
        // ============================================
        btn: function(text, title, active) {
            return $('<button type="button">').text(text).attr('title', title || '').css({
                background: active ? '#6C63FF' : '#2a2a3e',
                color: '#fff', border: 'none', borderRadius: '6px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
                fontFamily: 'sans-serif', minWidth: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s'
            }).on('mouseenter', function() {
                if (!$(this).data('active')) $(this).css('background', '#333');
            }).on('mouseleave', function() {
                if (!$(this).data('active')) $(this).css('background', '#2a2a3e');
            });
        },

        sep: function() {
            return $('<div>').css({ width: '1px', height: '20px', background: '#333', margin: '0 2px', flexShrink: '0' });
        },

        rgbToHex: function(rgb) {
            if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
            if (rgb.charAt(0) === '#') return rgb;
            var m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!m) return '#ffffff';
            return '#' + ((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1);
        },

        escAttr: function(s) {
            if (!s) return '';
            return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        notify: function(msg) {
            $('.m-notify').remove();
            var $n = $('<div class="m-notify">').css({
                position: 'fixed', bottom: '20px', left: '50%',
                transform: 'translateX(-50%)', background: '#1a1a2e',
                color: '#fff', padding: '10px 20px', borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 9999999,
                fontFamily: 'sans-serif', fontSize: '13px', fontWeight: '600',
                border: '1px solid rgba(108,99,255,0.3)'
            }).text(msg);
            $('body').append($n);
            setTimeout(function() { $n.fadeOut(300, function() { $n.remove(); }); }, 2500);
        }
    };

    /**
     * STANDALONE FUNCTION: Clean editor-only styles from a style string
     * This is kept outside the M object for use in sendCleanHtml
     */
    function cleanEditorStyles(style) {
        if (!style) return '';

        var props = style.split(';');
        var clean = [];

        for (var i = 0; i < props.length; i++) {
            var prop = props[i].trim();
            if (!prop) continue;

            // Skip editor-only properties
            var isEditorProp = false;

            for (var j = 0; j < EDITOR_ONLY_STYLES.length; j++) {
                if (prop.toLowerCase().indexOf(EDITOR_ONLY_STYLES[j]) === 0) {
                    isEditorProp = true;
                    break;
                }
            }

            // Skip cursor:text specifically (but keep other cursor values)
            if (!isEditorProp && /^\s*cursor\s*:\s*text\s*$/i.test(prop)) {
                isEditorProp = true;
            }

            if (!isEditorProp) {
                clean.push(prop);
            }
        }

        return clean.join('; ').trim();
    }

    // ============================================
    // BOOTSTRAP
    // ============================================
    $(document).ready(function() {
        M.tryInit();
    });

    if (typeof elementorFrontend !== 'undefined') {
        $(window).on('elementor/frontend/init', function() {
            setTimeout(function() { M.tryInit(); }, 1000);
        });
    }

    setTimeout(function() { M.tryInit(); }, 2000);

})(jQuery);
