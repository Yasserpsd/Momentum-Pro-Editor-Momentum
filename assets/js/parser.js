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
                if (name.indexOf('data-m4-') === 0 || name.indexOf('data-m-') === 0 || name === 'data-m3' || name === 'data-m4-init' || name === 'data-auto-sync') {
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
                classes = classes.replace(/\bmomentum-editable\b/g, '').replace(/\bmomentum-html-output\b/g, '').replace(/\s+/g, ' ').trim();
                if (classes) el.setAttribute('class', classes);
                else el.removeAttribute('class');
            }
        });

        $clone.removeAttr('data-widget-id');
        return $clone.html();
    }

    // ============================================
    // SMART SELECTION MANAGER
    // حل مشكلة ضياع التحديد عند التفاعل مع الـ toolbar
    // ============================================
    var SelectionManager = {
        _range: null,
        _targetEl: null,

        save: function() {
            try {
                var sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    this._range = sel.getRangeAt(0).cloneRange();
                    if (sel.anchorNode) {
                        this._targetEl = sel.anchorNode.nodeType === 3
                            ? sel.anchorNode.parentNode
                            : sel.anchorNode;
                    }
                }
            } catch(e) {}
        },

        restore: function() {
            try {
                if (!this._range) return false;
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(this._range);
                return true;
            } catch(e) {
                return false;
            }
        },

        hasSelection: function() {
            if (!this._range) return false;
            return !this._range.collapsed;
        },

        getSelectedText: function() {
            if (!this._range) return '';
            return this._range.toString().trim();
        },

        clear: function() {
            this._range = null;
            this._targetEl = null;
        },

        isInsideElement: function($el) {
            if (!this._targetEl) return false;
            return $.contains($el[0], this._targetEl) || $el[0] === this._targetEl;
        }
    };


    var M = {
        ready: false,
        setupRunning: false,
        retryCount: 0,
        maxRetries: 30,
        _observer: null,
        _rescanTimer: null,
        _$toolbar: null,
        _toolbarTarget: null,
        _activeWidgetId: null,

        init: function() {
            if (this.ready) return;
            var isEditor = false;
            try {
                isEditor = $('body').hasClass('elementor-editor-active') ||
                           $('body').hasClass('elementor-page') ||
                           (typeof elementorFrontend !== 'undefined' &&
                            typeof elementorFrontend.isEditMode === 'function' &&
                            elementorFrontend.isEditMode());
            } catch(e) {}
            if (!isEditor) return;
            this.ready = true;
            this.setup();
            this.watchDOM();
            this.listenMessages();
            this.setupKeyboardShortcuts();
            console.log('[Momentum] Parser: Active v7.0 (Stable)');
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

        setupKeyboardShortcuts: function() {
            var self = this;
            $(document).on('keydown.m7', function(e) {
                if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                    var $focused = $('[contenteditable="true"]:focus');
                    if ($focused.length && $focused.closest('.momentum-html-output').length) {
                        return; // السماح بالـ undo الطبيعي
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
                            self.notify('✅ تم مزامنة الكود!');
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
                    this.notify('⚠️ لا يوجد محتوى');
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
                this.notify('❌ خطأ في المزامنة');
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
                                if ($node.hasClass('momentum-html-output') ||
                                    $node.find('.momentum-html-output').length > 0) {
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
                    // ⛔ تم إزالة auto-sync بالكامل
                });
            } catch(e) {
                console.error('[Momentum] Setup error:', e);
            } finally {
                self.setupRunning = false;
            }
        },

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
            }).html('<svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.3)"/><text x="10" y="14" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">M</text></svg> Momentum Pro v7');
            $w.css('position', 'relative');
            $w.prepend($badge);
        },

        // ============================================
        // TEXT EDITING
        // ============================================
        makeEditable: function($w, wid) {
            var self = this;
            var skip = ['script','style','svg','path','circle','rect','line','polygon','polyline','ellipse','g','defs','clippath','use','symbol','br','hr','img','input','select','textarea','video','audio','canvas','iframe','object','embed','noscript','template'];

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
                    $el.on('click.m7', function(e) { e.preventDefault(); });
                }

                $el.on('mouseenter.m7', function(e) {
                    e.stopPropagation();
                    if (!$(this).is(':focus')) {
                        $(this).css({ outline: '2px dashed rgba(108,99,255,0.4)', outlineOffset: '2px' });
                    }
                }).on('mouseleave.m7', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css('outline', 'none');
                    }
                });

                $el.on('focus.m7', function(e) {
                    e.stopPropagation();
                    $(this).css({ outline: '2px solid #6C63FF', outlineOffset: '3px' });
                    self._activeWidgetId = wid;
                    self.showToolbar($(this), wid);
                });

                $el.on('blur.m7', function() {
                    var $this = $(this);
                    $this.css('outline', 'none');
                    setTimeout(function() {
                        if (!self.isToolbarActive() && !self.isLinkEditorActive()) {
                            self.hideToolbar();
                        }
                    }, 300);
                });

                // mouseup لتحديث الـ toolbar لما المستخدم بيحدد نص
                $el.on('mouseup.m7', function() {
                    var sel = window.getSelection();
                    if (sel && sel.toString().trim().length > 0) {
                        SelectionManager.save();
                    }
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

        isToolbarActive: function() {
            if (!this._$toolbar) return false;
            try {
                return this._$toolbar.is(':hover') ||
                       this._$toolbar.find(':focus').length > 0 ||
                       this._$toolbar.find('input:active').length > 0;
            } catch(e) { return false; }
        },

        isLinkEditorActive: function() {
            return $('#m-link-editor').length > 0;
        },

        // ============================================
        // TOOLBAR - محسّن بالكامل
        // ============================================
        showToolbar: function($el, wid) {
            var self = this;
            this.hideToolbar();
            this._toolbarTarget = $el;
            var off = $el.offset();

            var $bar = $('<div id="m-toolbar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 100) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px',
                padding: '8px 10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)',
                fontFamily: 'sans-serif', maxWidth: '660px'
            }).on('mousedown', function(e) {
                // مهم جداً: نمنع فقدان الـ focus من العنصر المحرر
                // لكن نسمح لـ input fields بالـ focus
                if (!$(e.target).is('input')) {
                    e.preventDefault();
                }
            });

            var s = function() { return self.sep(); };

            /* === ROW 1: Format + Colors === */
            var $row1 = $('<div>').css({ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' });

            // Bold
            var $bold = this.btn('B', 'Bold (عريض)').css('fontWeight', 'bold');
            $bold.on('mousedown', function(e) {
                e.preventDefault();
                document.execCommand('bold');
            });

            // Italic
            var $italic = this.btn('I', 'Italic (مائل)').css('fontStyle', 'italic');
            $italic.on('mousedown', function(e) {
                e.preventDefault();
                document.execCommand('italic');
            });

            // Underline
            var $underline = this.btn('U', 'Underline (تحت خط)').css('textDecoration', 'underline');
            $underline.on('mousedown', function(e) {
                e.preventDefault();
                document.execCommand('underline');
            });

            // Strikethrough
            var $strike = this.btn('S', 'خط في النص').css('textDecoration', 'line-through');
            $strike.on('mousedown', function(e) {
                e.preventDefault();
                document.execCommand('strikeThrough');
            });

            // ========================================
            // 🎨 لون النص - محسّن: يحفظ التحديد قبل فتح الـ color picker
            // ========================================
            var $tcLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('لون');
            var $tc = $('<input type="color">').val(self.rgbToHex($el.css('color') || '#333333')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            // حفظ التحديد عند الضغط على الـ color picker
            $tc.on('mousedown', function(e) {
                // لا نعمل preventDefault هنا عشان الـ color picker يفتح
                SelectionManager.save();
            });
            $tc.on('input', function() {
                var c = $(this).val();
                // استعادة التحديد قبل تطبيق اللون
                if (SelectionManager.hasSelection()) {
                    SelectionManager.restore();
                    document.execCommand('foreColor', false, c);
                    // نحفظ التحديد تاني بعد التطبيق
                    SelectionManager.save();
                } else {
                    // لو مفيش تحديد، غيّر لون العنصر كله
                    $el.css('color', c);
                }
            });

            // ========================================
            // 🎨 خلفية النص المحدد - محسّن
            // ========================================
            var $bgLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('خلفية');
            var $bg = $('<input type="color">').val('#ffff00').css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bg.on('mousedown', function() {
                SelectionManager.save();
            });
            $bg.on('input', function() {
                var c = $(this).val();
                if (SelectionManager.hasSelection()) {
                    SelectionManager.restore();
                    document.execCommand('hiliteColor', false, c);
                    SelectionManager.save();
                } else {
                    $el.css('background-color', c);
                }
            });

            // Remove format
            var $rf = this.btn('✕', 'إزالة التنسيق').css({ color: '#e74c3c' });
            $rf.on('mousedown', function(e) {
                e.preventDefault();
                document.execCommand('removeFormat');
            });

            $row1.append($bold, $italic, $underline, $strike, s(), $tcLabel, $tc, s(), $bgLabel, $bg, s(), $rf);

            /* === ROW 2: Alignment + Size + Link === */
            var $row2 = $('<div>').css({
                display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap',
                marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #333'
            });

            // Alignment
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

            // Font Size
            var sz = parseInt($el.css('font-size')) || 16;
            var $szD = this.btn('−', 'تصغير');
            var $szL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '36px', textAlign: 'center', display: 'inline-block' }).text(sz + 'px');
            var $szU = this.btn('+', 'تكبير');

            $szD.on('mousedown', function(e) { e.preventDefault(); sz = Math.max(6, sz - 1); $el.css('font-size', sz + 'px'); $szL.text(sz + 'px'); });
            $szU.on('mousedown', function(e) { e.preventDefault(); sz = Math.min(200, sz + 1); $el.css('font-size', sz + 'px'); $szL.text(sz + 'px'); });

            // Selection Font Size (تغيير حجم النص المحدد فقط)
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
            $lhD.on('mousedown', function(e) { e.preventDefault(); lh = Math.max(0.5, Math.round((lh - 0.1) * 10) / 10); $el.css('line-height', lh); $lhL.text(lh.toFixed(1)); });
            $lhU.on('mousedown', function(e) { e.preventDefault(); lh = Math.min(5, Math.round((lh + 0.1) * 10) / 10); $el.css('line-height', lh); $lhL.text(lh.toFixed(1)); });

            // ========================================
            // 🔗 زر إضافة رابط - محسّن
            // ========================================
            var $link = this.btn('🔗', 'ربط النص المحدد برابط');
            $link.on('mousedown', function(e) {
                e.preventDefault();
                SelectionManager.save();
                self.addLinkToSelection($el, wid);
            });

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
            if (this._$toolbar) { this._$toolbar.remove(); this._$toolbar = null; }
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
                // استعادة التحديد أولاً
                SelectionManager.restore();

                var sel = window.getSelection();
                if (!sel || sel.rangeCount === 0) return;
                var range = sel.getRangeAt(0);

                if (range.collapsed) {
                    // لو مفيش تحديد، غيّر حجم العنصر كله
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

                // استخدام fontSize ثم استبدال الـ font tag بـ span
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

        // ============================================
        // LINK MANAGEMENT - محسّن بالكامل
        // ============================================
        addLinkToSelection: function($el, wid) {
            var self = this;

            // لو العنصر نفسه رابط
            if ($el.is('a')) {
                self.showLinkPopup($el, wid);
                return;
            }

            var text = SelectionManager.getSelectedText();

            if (!text) {
                // محاولة أخيرة من الـ selection الحالي
                var sel = window.getSelection();
                if (sel) text = sel.toString().trim();
            }

            if (!text) {
                self.notify('⚠️ حدد نص الأول عشان تربطه برابط');
                return;
            }

            self.showLinkCreator($el, wid, text);
        },

        showLinkCreator: function($el, wid, selectedText) {
            var self = this;
            $('#m-link-editor').remove();
            var off = $el.offset();
            var IS = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $el.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '320px', fontFamily: 'sans-serif'
            }).on('mousedown', function(e) {
                e.stopPropagation();
                // لا نعمل preventDefault عشان الـ inputs تشتغل
            });

            $ed.html(
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">' +
                    '<span style="color:#6C63FF;font-size:16px;">🔗</span>' +
                    '<span style="color:#6C63FF;font-weight:700;font-size:14px;">إضافة رابط</span>' +
                '</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص المحدد' +
                    '<div style="' + IS + 'background:#1a1a2e;margin-top:4px;min-height:20px;padding:8px 12px;color:#6C63FF;font-weight:600;" id="ml-txt-display">' + self.escHtml(selectedText) + '</div>' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL' +
                    '<input type="url" id="ml-url" value="" placeholder="https://example.com" style="' + IS + '">' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">لون الرابط' +
                    '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">' +
                        '<input type="color" id="ml-color" value="#6C63FF" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;background:transparent;padding:0;">' +
                        '<span id="ml-color-label" style="color:#fff;font-size:12px;">#6C63FF</span>' +
                    '</div>' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">' +
                    '<input type="checkbox" id="ml-blank" checked> فتح في تاب جديد' +
                '</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                    '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                    '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">إضافة</button>' +
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

                if (!url) {
                    self.notify('⚠️ أدخل رابط');
                    return;
                }

                // استعادة التحديد المحفوظ
                var restored = SelectionManager.restore();

                if (!restored) {
                    self.notify('⚠️ فقد التحديد - حدد النص مرة تانية');
                    $ed.remove();
                    return;
                }

                var sel = window.getSelection();
                if (!sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed) {
                    self.notify('⚠️ فقد التحديد - حدد النص مرة تانية');
                    $ed.remove();
                    return;
                }

                // إنشاء الرابط
                document.execCommand('createLink', false, url);

                // تطبيق الخصائص على الرابط الجديد
                $el.find('a[href="' + url + '"]').each(function() {
                    var $a = $(this);
                    if (bl) {
                        $a.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    }
                    if (linkColor) {
                        $a.css('color', linkColor);
                    }
                    // ربط الـ double click لتعديل الرابط لاحقاً
                    $a.data('m4-link', true).on('dblclick.m7', function(ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        self.showLinkPopup($(this), wid);
                    });
                });

                $ed.remove();
                SelectionManager.clear();
                self.notify('🔗 تم إضافة الرابط!');
            });

            $ed.find('#ml-x').on('click', function() {
                $ed.remove();
                SelectionManager.clear();
            });

            $ed.find('#ml-url').on('keydown', function(e) {
                if (e.key === 'Enter') $ed.find('#ml-ok').trigger('click');
            });

            // Focus على حقل الـ URL بدون ما نضيع الـ selection
            setTimeout(function() {
                try { $ed.find('#ml-url')[0].focus({ preventScroll: true }); } catch(e) {}
            }, 50);

            // إغلاق لو اتضغط برا
            setTimeout(function() {
                $(document).on('click.mlink7', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        SelectionManager.clear();
                        $(document).off('click.mlink7');
                    }
                });
            }, 200);
        },

        setupLinks: function($w, wid) {
            var self = this;
            $w.find('a').each(function() {
                var $a = $(this);
                if ($a.data('m4-link')) return;
                $a.data('m4-link', true);
                $a.on('dblclick.m7', function(e) {
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
            var IS = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';
            var href = $el.is('a') ? ($el.attr('href') || '') : '';
            var txt = $el.text().trim();
            var blank = $el.is('a') ? ($el.attr('target') === '_blank') : true;
            var currentColor = $el.css('color') || '#6C63FF';

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
                    '<span style="color:#6C63FF;font-size:16px;">🔗</span>' +
                    '<span style="color:#6C63FF;font-weight:700;font-size:14px;">تعديل الرابط</span>' +
                '</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL' +
                    '<input type="url" id="ml-url" value="' + self.escAttr(href) + '" placeholder="https://example.com" style="' + IS + '">' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص' +
                    '<input type="text" id="ml-txt" value="' + self.escAttr(txt) + '" style="' + IS + '">' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">لون الرابط' +
                    '<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">' +
                        '<input type="color" id="ml-color" value="' + self.rgbToHex(currentColor) + '" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;background:transparent;padding:0;">' +
                        '<span id="ml-color-label" style="color:#fff;font-size:12px;">' + self.rgbToHex(currentColor) + '</span>' +
                    '</div>' +
                '</label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">' +
                    '<input type="checkbox" id="ml-blank" ' + (blank ? 'checked' : '') + '> فتح في تاب جديد' +
                '</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                    '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                    ($el.is('a') ? '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">حذف</button>' : '') +
                    '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">حفظ</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-color').on('input', function() {
                $ed.find('#ml-color-label').text($(this).val());
            });

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var t = $ed.find('#ml-txt').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');
                var linkColor = $ed.find('#ml-color').val();
                if (!url) { self.notify('⚠️ أدخل رابط'); return; }
                if ($el.is('a')) {
                    $el.attr('href', url);
                    var hasChildEls = false;
                    $el.children().each(function() { if (this.nodeType === 1) { hasChildEls = true; return false; } });
                    if (!hasChildEls && t) $el.text(t);
                    if (bl) $el.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    else $el.removeAttr('target').removeAttr('rel');
                    if (linkColor) $el.css('color', linkColor);
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
            $ed.find('#ml-url, #ml-txt').on('keydown', function(e) {
                if (e.key === 'Enter') $ed.find('#ml-ok').trigger('click');
            });
            setTimeout(function() {
                $(document).on('click.mlink7', function(e) {
                    if (!$(e.target).closest('#m-link-editor').length) {
                        $ed.remove();
                        $(document).off('click.mlink7');
                    }
                });
            }, 200);
        },

        // ============================================
        // IMAGE MANAGEMENT
        // ============================================
        setupImages: function($w, wid) {
            var self = this;
            $w.find('img').each(function() {
                var $img = $(this);
                if ($img.data('m4-img')) return;
                $img.data('m4-img', true);
                $img.attr('contenteditable', 'false');
                $img.css({ cursor: 'pointer', transition: 'outline 0.15s' });

                $img.on('mouseenter.m7', function() {
                    if (!$(this).data('m4-isel')) $(this).css({ outline: '3px solid rgba(108,99,255,0.5)', outlineOffset: '3px' });
                }).on('mouseleave.m7', function() {
                    if (!$(this).data('m4-isel')) $(this).css('outline', 'none');
                });

                $img.on('click.m7', function(e) {
                    e.preventDefault(); e.stopPropagation();
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

            // Replace image
            var $rep = this.btn('📷', 'استبدال');
            $rep.on('mousedown', function(e) {
                e.preventDefault();
                try {
                    var frame = wp.media({
                        title: 'اختر صورة',
                        multiple: false,
                        library: { type: 'image' }
                    });
                    frame.on('select', function() {
                        var att = frame.state().get('selection').first().toJSON();
                        $img.attr('src', att.url);
                        if (att.width) $img.css('width', att.width + 'px');
                        if (att.height) $img.css('height', att.height + 'px');
                        self.notify('📷 تم تغيير الصورة!');
                    });
                    frame.open();
                } catch(err) {
                    console.warn('[Momentum] Media library error:', err);
                    self.notify('❌ خطأ في فتح مكتبة الوسائط');
                }
            });

            // Width controls
            var $wD = this.btn('W−', 'تصغير العرض');
            var $wL = $('<span>').css({ color: '#fff', fontSize: '10px', minWidth: '40px', textAlign: 'center', display: 'inline-block' }).text(Math.round(w) + 'px');
            var $wU = this.btn('W+', 'تكبير العرض');

            $wD.on('mousedown', function(e) { e.preventDefault(); w = Math.max(20, w - 10); $img.css('width', w + 'px'); h = w / ratio; $img.css('height', h + 'px'); $wL.text(Math.round(w) + 'px'); });
            $wU.on('mousedown', function(e) { e.preventDefault(); w = Math.min(2000, w + 10); $img.css('width', w + 'px'); h = w / ratio; $img.css('height', h + 'px'); $wL.text(Math.round(w) + 'px'); });

            // Border radius
            var br = parseInt($img.css('border-radius')) || 0;
            var $brD = this.btn('R−', 'تقليل الحواف');
            var $brL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(br + 'px');
            var $brU = this.btn('R+', 'زيادة الحواف');

            $brD.on('mousedown', function(e) { e.preventDefault(); br = Math.max(0, br - 2); $img.css('border-radius', br + 'px'); $brL.text(br + 'px'); });
            $brU.on('mousedown', function(e) { e.preventDefault(); br = Math.min(200, br + 2); $img.css('border-radius', br + 'px'); $brL.text(br + 'px'); });

            // Delete
            var $del = this.btn('🗑', 'حذف الصورة').css({ color: '#e74c3c' });
            $del.on('mousedown', function(e) {
                e.preventDefault();
                if (confirm('حذف الصورة؟')) {
                    $img.remove();
                    $bar.remove();
                    self.notify('تم حذف الصورة');
                }
            });

            $bar.append($rep, s(), $wD, $wL, $wU, s(), $brD, $brL, $brU, s(), $del);
            $('body').append($bar);

            // Click outside to deselect
            setTimeout(function() {
                $(document).on('click.mimg7', function(e) {
                    if (!$(e.target).closest('.m-img-bar').length && !$(e.target).is($img[0])) {
                        $img.removeData('m4-isel').css('outline', 'none');
                        $bar.remove();
                        $(document).off('click.mimg7');
                    }
                });
            }, 100);
        },

        // ============================================
        // BOX (DIV) MANAGEMENT
        // ============================================
        setupBoxes: function($w, wid) {
            var self = this;
            $w.find('div, section, article, header, footer, main, aside, nav, figure').each(function() {
                var $box = $(this);
                var tag = (this.tagName || '').toLowerCase();
                if ($box.hasClass('momentum-html-output') || $box.hasClass('m-badge') || $box.hasClass('m-notify')) return;
                if ($box.closest('#m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar').length) return;
                if ($box.data('m4-box')) return;
                $box.data('m4-box', true);

                $box.on('contextmenu.m7', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.showBoxBar($(this), wid);
                });
            });
        },

        showBoxBar: function($box, wid) {
            var self = this;
            $('.m-box-bar').remove();
            var off = $box.offset();

            $box.data('m4-bsel', true);
            $box.css({ outline: '2px solid #4CAF50', outlineOffset: '2px' });

            var $bar = $('<div class="m-box-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 42) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(76,175,80,0.3)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            var s = function() { return self.sep(); };

            // Background color
            var $bgL = $('<span>').css({ color: '#aaa', fontSize: '10px' }).text('خلفية');
            var $bgC = $('<input type="color">').val(self.rgbToHex($box.css('background-color') || '#ffffff')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bgC.on('input', function() { $box.css('background-color', $(this).val()); });

            // Padding
            var pad = parseInt($box.css('padding-top')) || 0;
            var $pD = this.btn('P−', 'تقليل');
            var $pL = $('<span>').css({ color: '#fff', fontSize: '10px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(pad + 'px');
            var $pU = this.btn('P+', 'زيادة');
            $pD.on('mousedown', function(e) { e.preventDefault(); pad = Math.max(0, pad - 5); $box.css('padding', pad + 'px'); $pL.text(pad + 'px'); });
            $pU.on('mousedown', function(e) { e.preventDefault(); pad = Math.min(200, pad + 5); $box.css('padding', pad + 'px'); $pL.text(pad + 'px'); });

            // Border radius
            var brd = parseInt($box.css('border-radius')) || 0;
            var $bD = this.btn('R−', 'تقليل');
            var $bL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(brd + 'px');
            var $bU = this.btn('R+', 'زيادة');
            $bD.on('mousedown', function(e) { e.preventDefault(); brd = Math.max(0, brd - 2); $box.css('border-radius', brd + 'px'); $bL.text(brd + 'px'); });
            $bU.on('mousedown', function(e) { e.preventDefault(); brd = Math.min(200, brd + 2); $box.css('border-radius', brd + 'px'); $bL.text(brd + 'px'); });

            var tagName = ($box.prop('tagName') || '').toLowerCase();
            var $tagLabel = $('<span>').css({
                color: '#4CAF50', fontSize: '9px', fontFamily: 'monospace',
                background: 'rgba(76,175,80,0.15)', padding: '2px 6px',
                borderRadius: '4px'
            }).text(tagName);

            $bar.append($bgL, $bgC, s(), $pD, $pL, $pU, s(), $bD, $bL, $bU, s(), $tagLabel);
            $('body').append($bar);

            setTimeout(function() {
                $(document).on('click.mbox7', function(e) {
                    if (!$(e.target).closest('.m-box-bar').length) {
                        $box.removeData('m4-bsel').css('outline', 'none');
                        $bar.remove();
                        $(document).off('click.mbox7');
                    }
                });
            }, 100);
        },

        // ============================================
        // UTILITIES
        // ============================================
        btn: function(text, title, active) {
            return $('<button type="button">').text(text).attr('title', title || '').css({
                background: active ? '#6C63FF' : '#2a2a3e',
                color: '#fff', border: 'none', borderRadius: '6px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
                fontFamily: 'sans-serif', minWidth: '26px', textAlign: 'center',
                transition: 'background 0.15s',
                lineHeight: '1.4'
            }).on('mouseenter', function() {
                if (!active) $(this).css('background', '#3a3a5e');
            }).on('mouseleave', function() {
                if (!active) $(this).css('background', '#2a2a3e');
            });
        },

        sep: function() {
            return $('<span>').css({
                width: '1px', height: '20px', background: '#333',
                display: 'inline-block', margin: '0 2px'
            });
        },

        rgbToHex: function(rgb) {
            if (!rgb) return '#333333';
            if (rgb.indexOf('#') === 0) {
                if (rgb.length === 4) {
                    return '#' + rgb[1] + rgb[1] + rgb[2] + rgb[2] + rgb[3] + rgb[3];
                }
                return rgb;
            }
            var match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!match) return '#333333';
            var r = parseInt(match[1]).toString(16).padStart(2, '0');
            var g = parseInt(match[2]).toString(16).padStart(2, '0');
            var b = parseInt(match[3]).toString(16).padStart(2, '0');
            return '#' + r + g + b;
        },

        escHtml: function(s) {
            var d = document.createElement('div');
            d.textContent = s;
            return d.innerHTML;
        },

        escAttr: function(s) {
            return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        notify: function(msg) {
            $('.m-notify').remove();
            var $n = $('<div class="m-notify">').css({
                position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                background: '#1a1a2e', color: '#fff', padding: '12px 24px', borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 999999, fontSize: '14px',
                fontFamily: 'sans-serif', border: '1px solid rgba(108,99,255,0.3)',
                whiteSpace: 'nowrap'
            }).text(msg);
            $('body').append($n);
            setTimeout(function() { $n.fadeOut(300, function() { $n.remove(); }); }, 2500);
        }
    };

    // ============================================
    // INIT
    // ============================================
    $(document).ready(function() {
        setTimeout(function() { M.tryInit(); }, 800);
    });

    if (typeof elementorFrontend !== 'undefined') {
        $(window).on('elementor/frontend/init', function() {
            setTimeout(function() { M.tryInit(); }, 1000);
        });
    }

})(jQuery);
