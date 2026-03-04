(function($) {
    'use strict';

    var M = {
        ready: false,
        setupRunning: false,
        retryCount: 0,
        maxRetries: 30,
        activeWidget: null,
        _observer: null,
        _rescanTimer: null,

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
            console.log('[Momentum] Parser: Active v4.0');
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
                        self.sendHtmlToPanel(e.data.widgetId);
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
         * Extract the live HTML from the widget and send it to the panel
         */
        sendHtmlToPanel: function(widgetId) {
            var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
            if (!$w.length) return;

            // Clone the widget content
            var $clone = $w.clone();

            // Remove editor artifacts
            $clone.find('.m-badge').remove();
            $clone.find('[contenteditable]').removeAttr('contenteditable');
            $clone.find('*').each(function() {
                // Remove data-m attributes
                var attrs = this.attributes;
                var toRemove = [];
                for (var i = 0; i < attrs.length; i++) {
                    if (attrs[i].name.indexOf('data-m-') === 0) {
                        toRemove.push(attrs[i].name);
                    }
                }
                for (var j = 0; j < toRemove.length; j++) {
                    this.removeAttribute(toRemove[j]);
                }

                // Clean up editor-only styles
                var style = this.getAttribute('style');
                if (style) {
                    style = style.replace(/outline\s*:[^;]*;?/gi, '');
                    style = style.replace(/outline-offset\s*:[^;]*;?/gi, '');
                    style = style.replace(/cursor\s*:\s*text\s*;?/gi, '');
                    style = style.replace(/;\s*;/g, ';');
                    style = style.replace(/^\s*;\s*/, '').replace(/\s*;\s*$/, '');
                    if (style.trim()) {
                        this.setAttribute('style', style.trim());
                    } else {
                        this.removeAttribute('style');
                    }
                }
            });

            var html = $clone.html();

            // Remove the <style> tag of custom CSS (it comes from Elementor control)
            html = html.replace(/<style>[\s\S]*?<\/style>/gi, '').trim();

            window.parent.postMessage({
                type: 'momentum-request-sync',
                widgetId: widgetId,
                html: html
            }, '*');
        },

        handleReset: function(widgetId) {
            var $w = $('.momentum-html-output[data-widget-id="' + widgetId + '"]');
            if ($w.length) {
                $w.removeData('m4-init');
                setTimeout(function() { M.setup(); }, 500);
            }
        },

        // ============================================
        // DOM WATCHER (lightweight)
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
        // MAKE TEXT ELEMENTS EDITABLE
        // Key change: use contenteditable on text elements
        // and use Selection API for partial text styling
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

                // Check if element has direct text content
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

                // Prevent links from navigating
                if (tag === 'a') {
                    $el.on('click.m4', function(e) { e.preventDefault(); });
                }

                // Hover effect
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

                // Focus: show toolbar
                $el.on('focus.m4', function(e) {
                    e.stopPropagation();
                    $(this).css({ outline: '2px solid #6C63FF', outlineOffset: '3px' });
                    self.activeWidget = wid;
                    self.showToolbar($(this), wid);
                });

                // Blur: hide toolbar
                $el.on('blur.m4', function() {
                    var $this = $(this);
                    $this.css('outline', 'none');
                    setTimeout(function() {
                        if (!self.isToolbarActive()) {
                            self.hideToolbar();
                        }
                    }, 300);
                });

                // Listen for selection changes to enable/disable toolbar buttons
                $el.on('mouseup.m4 keyup.m4', function() {
                    self.updateToolbarState();
                });
            });
        },

        isIcon: function(el) {
            var $el = $(el);
            var tag = (el.tagName || '').toLowerCase();

            if (tag === 'svg' || tag === 'i') {
                if ($el.text().trim().length <= 1) return true;
            }
            if ($el.find('svg').length > 0 && $el.children().length > 0) {
                var t = '';
                for (var i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].textContent.trim();
                }
                if (t.length <= 2) return true;
            }

            var cls = (el.className || '').toString();
            if (/\b(fa|fas|far|fab|fal|fad|dashicons|eicon|ti-|glyphicon|material-icons|icon)\b/i.test(cls)) return true;

            return false;
        },

        // ============================================
        // TOOLBAR (the main UI)
        // Supports PARTIAL TEXT SELECTION styling
        // ============================================
        _$toolbar: null,
        _toolbarTarget: null,
        _toolbarWid: null,

        isToolbarActive: function() {
            return this._$toolbar && this._$toolbar.is(':visible') &&
                   this._$toolbar.is(':hover, :focus-within');
        },

        showToolbar: function($el, wid) {
            var self = this;

            // Remove old toolbar
            this.hideToolbar();

            this._toolbarTarget = $el;
            this._toolbarWid = wid;

            var off = $el.offset();
            var elH = $el.outerHeight();

            var $bar = $('<div id="m-toolbar">').css({
                position: 'absolute',
                zIndex: 999999,
                top: Math.max(5, off.top - 90) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e',
                borderRadius: '12px',
                padding: '8px 10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)',
                fontFamily: 'sans-serif',
                maxWidth: '620px'
            }).on('mousedown', function(e) {
                // Prevent toolbar click from stealing focus/selection
                // BUT allow clicks on input elements (color pickers)
                if (!$(e.target).is('input')) {
                    e.preventDefault();
                }
            });

            var s = function() { return self.createSep(); };

            // ===== ROW 1: Text formatting =====
            var $row1 = $('<div>').css({ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' });

            // Bold
            var $bold = this.createBtn('B', 'Bold (Ctrl+B)').css('fontWeight', 'bold');
            $bold.on('mousedown', function(e) {
                e.preventDefault();
                self.applyInlineCommand('bold');
                self.updateToolbarState();
            });

            // Italic
            var $italic = this.createBtn('I', 'Italic (Ctrl+I)').css('fontStyle', 'italic');
            $italic.on('mousedown', function(e) {
                e.preventDefault();
                self.applyInlineCommand('italic');
                self.updateToolbarState();
            });

            // Underline
            var $underline = this.createBtn('U', 'Underline (Ctrl+U)').css('textDecoration', 'underline');
            $underline.on('mousedown', function(e) {
                e.preventDefault();
                self.applyInlineCommand('underline');
                self.updateToolbarState();
            });

            // Strikethrough
            var $strike = this.createBtn('S', 'Strikethrough').css('textDecoration', 'line-through');
            $strike.on('mousedown', function(e) {
                e.preventDefault();
                self.applyInlineCommand('strikeThrough');
                self.updateToolbarState();
            });

            // Text Color (for selection)
            var currentColor = $el.css('color') || '#333333';
            var $textColorLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('لون');
            var $textColor = $('<input type="color">').val(self.rgbToHex(currentColor)).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $textColor.on('input', function() {
                var color = $(this).val();
                self.applyColorToSelection(color);
            });

            // Background Color (for selection)
            var $bgColorLabel = $('<span>').css({ color: '#aaa', fontSize: '10px', marginRight: '2px' }).text('خلفية');
            var $bgColor = $('<input type="color">').val('#ffff00').css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bgColor.on('input', function() {
                var color = $(this).val();
                self.applyBgColorToSelection(color);
            });

            // Remove Format
            var $removeFormat = this.createBtn('✕', 'Remove Formatting');
            $removeFormat.css({ color: '#e74c3c', fontSize: '12px' });
            $removeFormat.on('mousedown', function(e) {
                e.preventDefault();
                self.applyInlineCommand('removeFormat');
                self.updateToolbarState();
            });

            $row1.append($bold, $italic, $underline, $strike, s(),
                         $textColorLabel, $textColor, s(),
                         $bgColorLabel, $bgColor, s(),
                         $removeFormat);

            // ===== ROW 2: Block-level formatting =====
            var $row2 = $('<div>').css({
                display: 'flex', gap: '3px', alignItems: 'center',
                flexWrap: 'wrap', marginTop: '4px', paddingTop: '4px',
                borderTop: '1px solid #333'
            });

            // Text Align
            var $aR = this.createBtn('⇢', 'Align Right').attr('data-align', 'right');
            var $aC = this.createBtn('⇔', 'Align Center').attr('data-align', 'center');
            var $aL = this.createBtn('⇠', 'Align Left').attr('data-align', 'left');
            var currentAlign = $el.css('text-align') || 'right';
            [$aR, $aC, $aL].forEach(function($btn) {
                if ($btn.attr('data-align') === currentAlign) {
                    $btn.css('background', '#6C63FF');
                }
                $btn.on('mousedown', function(e) {
                    e.preventDefault();
                    var a = $(this).attr('data-align');
                    $el.css('text-align', a);
                    [$aR, $aC, $aL].forEach(function(b) { b.css('background', '#2a2a3e'); });
                    $(this).css('background', '#6C63FF');
                });
            });

            // Font Size
            var sz = parseInt($el.css('font-size')) || 16;
            var $szD = this.createBtn('−', 'حجم أصغر');
            var $szL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '36px', textAlign: 'center', userSelect: 'none', display: 'inline-block' }).text(sz + 'px');
            var $szU = this.createBtn('+', 'حجم أكبر');

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

            // Font Size for Selection
            var $szSelD = this.createBtn('A↓', 'تصغير النص المحدد');
            var $szSelU = this.createBtn('A↑', 'تكبير النص المحدد');

            $szSelD.on('mousedown', function(e) {
                e.preventDefault();
                self.changeFontSizeSelection(-1);
            });
            $szSelU.on('mousedown', function(e) {
                e.preventDefault();
                self.changeFontSizeSelection(1);
            });

            // Line Height
            var lh = parseFloat($el.css('line-height')) / (parseInt($el.css('font-size')) || 16);
            lh = Math.round(lh * 10) / 10 || 1.5;
            var $lhD = this.createBtn('↕−', 'تقليل ارتفاع السطر');
            var $lhL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '26px', textAlign: 'center', display: 'inline-block' }).text(lh.toFixed(1));
            var $lhU = this.createBtn('↕+', 'زيادة ارتفاع السطر');

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
            var $link = this.createBtn('🔗', 'إضافة رابط');
            $link.on('mousedown', function(e) {
                e.preventDefault();
                self.wrapSelectionWithLink($el, wid);
            });

            $row2.append($aR, $aC, $aL, s(), $szD, $szL, $szU, s(), $szSelD, $szSelU, s(),
                         $lhD, $lhL, $lhU, s(), $link);

            $bar.append($row1, $row2);
            $('body').append($bar);

            this._$toolbar = $bar;

            // Adjust position if toolbar goes off screen
            this.fixToolbarPosition($bar, off, $el);
        },

        hideToolbar: function() {
            if (this._$toolbar) {
                this._$toolbar.remove();
                this._$toolbar = null;
            }
            this._toolbarTarget = null;
        },

        updateToolbarState: function() {
            // Could update active state of B/I/U buttons based on current selection
            // This is a nice-to-have enhancement
        },

        fixToolbarPosition: function($bar, off, $el) {
            var barW = $bar.outerWidth();
            var winW = $(window).width();
            var winScroll = $(window).scrollTop();

            if (off.left + barW > winW - 10) {
                $bar.css('left', Math.max(10, winW - barW - 10) + 'px');
            }

            var barTop = parseInt($bar.css('top'));
            if (barTop < winScroll + 5) {
                // Place below the element instead
                $bar.css('top', (off.top + $el.outerHeight() + 8) + 'px');
            }
        },

        // ============================================
        // INLINE STYLING COMMANDS
        // These work on SELECTED TEXT only!
        // ============================================

        /**
         * Apply a document.execCommand for inline formatting
         */
        applyInlineCommand: function(command) {
            document.execCommand(command, false, null);
        },

        /**
         * Apply text color to the current selection using execCommand
         */
        applyColorToSelection: function(color) {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            var range = sel.getRangeAt(0);
            if (range.collapsed) {
                // No selection - apply to the whole focused element
                if (this._toolbarTarget) {
                    this._toolbarTarget.css('color', color);
                }
                return;
            }

            // Use execCommand foreColor for selected text
            document.execCommand('foreColor', false, color);
        },

        /**
         * Apply background color to the current selection
         */
        applyBgColorToSelection: function(color) {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            var range = sel.getRangeAt(0);
            if (range.collapsed) {
                if (this._toolbarTarget) {
                    this._toolbarTarget.css('background-color', color);
                }
                return;
            }

            document.execCommand('hiliteColor', false, color);
        },

        /**
         * Change font size for the selected text
         */
        changeFontSizeSelection: function(delta) {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            var range = sel.getRangeAt(0);

            if (range.collapsed) {
                // No selection, change element font size
                if (this._toolbarTarget) {
                    var sz = parseInt(this._toolbarTarget.css('font-size')) || 16;
                    sz = Math.max(6, Math.min(200, sz + delta));
                    this._toolbarTarget.css('font-size', sz + 'px');
                }
                return;
            }

            // For selected text, wrap in a span with the new size
            // First, use fontSize command (uses 1-7 scale, not ideal)
            // Better approach: wrap selection in span manually
            var selectedText = range.toString();
            if (!selectedText) return;

            // Get computed font size of the selection start
            var container = range.startContainer;
            if (container.nodeType === 3) container = container.parentNode;
            var currentSize = parseInt(window.getComputedStyle(container).fontSize) || 16;
            var newSize = Math.max(6, Math.min(200, currentSize + delta));

            // Create a span with the new size
            var span = document.createElement('span');
            span.style.fontSize = newSize + 'px';

            try {
                range.surroundContents(span);
                // Reselect
                sel.removeAllRanges();
                var newRange = document.createRange();
                newRange.selectNodeContents(span);
                sel.addRange(newRange);
            } catch(e) {
                // surroundContents fails if selection spans multiple nodes
                // Fallback: use execCommand fontSize with a placeholder, then fix
                document.execCommand('fontSize', false, '7');
                // Find all font elements with size 7 and replace with span
                if (this._toolbarTarget) {
                    this._toolbarTarget.find('font[size="7"]').each(function() {
                        var $font = $(this);
                        var $span = $('<span>').css('font-size', newSize + 'px').html($font.html());
                        $font.replaceWith($span);
                    });
                }
            }
        },

        /**
         * Wrap the current selection with a link
         */
        wrapSelectionWithLink: function($el, wid) {
            var self = this;
            var sel = window.getSelection();
            var selectedText = sel ? sel.toString().trim() : '';

            if ($el.is('a')) {
                // If element itself is a link, show link editor
                self.showLinkPopup($el, wid);
                return;
            }

            if (!selectedText) {
                self.notify('⚠️ حدد نص أولاً عشان تضيف رابط');
                return;
            }

            var url = prompt('أدخل الرابط (URL):', 'https://');
            if (!url) return;

            document.execCommand('createLink', false, url);

            // Find the newly created link and style it
            $el.find('a[href="' + url + '"]').css({
                color: '#6C63FF',
                textDecoration: 'underline'
            }).attr('target', '_blank').attr('rel', 'noopener noreferrer');

            self.notify('🔗 تم إضافة الرابط!');
        },

        // ============================================
        // LINK EDITING (double-click)
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
                '<div style="color:#6C63FF;font-weight:700;font-size:14px;margin-bottom:12px;">🔗 تعديل الرابط</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="' + self.escAttr(href) + '" placeholder="https://example.com" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص<input type="text" id="ml-txt" value="' + self.escAttr(txt) + '" style="' + inputStyle + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" ' + (blank ? 'checked' : '') + '> فتح في تاب جديد</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                ($el.is('a') ? '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">حذف الرابط</button>' : '') +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">حفظ</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val().trim();
                var t = $ed.find('#ml-txt').val().trim();
                var bl = $ed.find('#ml-blank').is(':checked');

                if (!url) { alert('أدخل رابط من فضلك'); return; }

                if ($el.is('a')) {
                    $el.attr('href', url);
                    if (t) {
                        // Only change text if no child elements
                        var hasChildEls = false;
                        $el.children().each(function() {
                            if (this.nodeType === 1) { hasChildEls = true; return false; }
                        });
                        if (!hasChildEls) $el.text(t);
                    }
                    if (bl) {
                        $el.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    } else {
                        $el.removeAttr('target').removeAttr('rel');
                    }
                }

                $ed.remove();
                self.notify('🔗 تم حفظ الرابط!');
            });

            if ($el.is('a')) {
                $ed.find('#ml-del').on('click', function() {
                    var t2 = $el.text();
                    $el.replaceWith(t2);
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
        // IMAGE EDITING
        // Images are NOT inside contenteditable
        // They get their own click handler
        // ============================================
        setupImages: function($w, wid) {
            var self = this;
            $w.find('img').each(function(idx) {
                var $img = $(this);
                if ($img.data('m4-img')) return;
                $img.data('m4-img', true);

                // Make sure images are not contenteditable
                $img.attr('contenteditable', 'false');
                $img.css({ cursor: 'pointer', transition: 'outline 0.15s' });

                $img.on('mouseenter.m4', function() {
                    if (!$(this).data('m4-img-sel')) {
                        $(this).css({ outline: '3px solid rgba(108,99,255,0.5)', outlineOffset: '3px' });
                    }
                }).on('mouseleave.m4', function() {
                    if (!$(this).data('m4-img-sel')) {
                        $(this).css('outline', 'none');
                    }
                });

                $img.on('click.m4', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Deselect any text selection
                    window.getSelection().removeAllRanges();

                    self.selectImage($(this), wid);
                });
            });
        },

        selectImage: function($img, wid) {
            var self = this;

            // Deselect previous
            $('[data-m4-img-sel]').removeData('m4-img-sel').css('outline', 'none');
            $('.m-img-bar, .m-resize-h').remove();
            this.hideToolbar();

            $img.data('m4-img-sel', true);
            $img.css({ outline: '3px solid #6C63FF', outlineOffset: '3px' });

            var off = $img.offset();
            var w = $img.width();
            var h = $img.height();

            // Image toolbar
            var $bar = $('<div class="m-img-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 42) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(108,99,255,0.3)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            // Replace image button
            var $replace = this.createBtn('📷', 'استبدال الصورة');
            $replace.on('mousedown', function(e) {
                e.preventDefault();
                var frame = wp.media({
                    title: 'اختر صورة',
                    multiple: false,
                    library: { type: 'image' }
                });
                frame.on('select', function() {
                    var attachment = frame.state().get('selection').first().toJSON();
                    $img.attr('src', attachment.url);
                    if (attachment.width) $img.attr('width', attachment.width);
                    if (attachment.height) $img.attr('height', attachment.height);
                    self.notify('✅ تم تغيير الصورة!');
                    self.selectImage($img, wid);
                });
                frame.open();
            });

            // Width/Height
            var $wLabel = $('<span>').css({ color: '#aaa', fontSize: '10px' }).text('W:');
            var $wD = this.createBtn('−', 'Width -');
            var $wL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }).text(w);
            var $wU = this.createBtn('+', 'Width +');

            var ratio = w / h;

            $wD.on('mousedown', function(e) {
                e.preventDefault();
                w = Math.max(30, w - 10);
                h = Math.round(w / ratio);
                $img.css({ width: w + 'px', height: h + 'px' }).attr({ width: w, height: h });
                $wL.text(w);
            });
            $wU.on('mousedown', function(e) {
                e.preventDefault();
                w += 10;
                h = Math.round(w / ratio);
                $img.css({ width: w + 'px', height: h + 'px' }).attr({ width: w, height: h });
                $wL.text(w);
            });

            // Border Radius
            var br = parseInt($img.css('border-radius')) || 0;
            var $brD = this.createBtn('◻', 'تقليل الحواف');
            var $brL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '22px', textAlign: 'center', display: 'inline-block' }).text(br);
            var $brU = this.createBtn('◯', 'زيادة الحواف');

            $brD.on('mousedown', function(e) {
                e.preventDefault();
                br = Math.max(0, br - 4);
                $img.css('border-radius', br + 'px');
                $brL.text(br);
            });
            $brU.on('mousedown', function(e) {
                e.preventDefault();
                br += 4;
                $img.css('border-radius', br + 'px');
                $brL.text(br);
            });

            var s = function() { return self.createSep(); };
            $bar.append($replace, s(), $wLabel, $wD, $wL, $wU, s(), $brD, $brL, $brU);
            $('body').append($bar);

            // Click elsewhere to deselect
            setTimeout(function() {
                $(document).on('click.mimgdesel4', function(e) {
                    if (!$(e.target).closest('.m-img-bar').length && !$(e.target).is($img[0])) {
                        $img.removeData('m4-img-sel').css('outline', 'none');
                        $('.m-img-bar, .m-resize-h').remove();
                        $(document).off('click.mimgdesel4');
                    }
                });
            }, 100);
        },

        // ============================================
        // BOX EDITING (right-click on containers)
        // ============================================
        setupBoxes: function($w, wid) {
            var self = this;
            $w.find('div, section, article, header, footer, ul, ol, table, blockquote, aside, nav, main').each(function() {
                var $box = $(this);
                if ($box.data('m4-box')) return;
                if ($box.hasClass('momentum-html-output')) return;
                if ($box.hasClass('m-badge')) return;
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
                    if (!$(this).data('m4-box-sel')) {
                        $(this).css({ outline: '1px dashed rgba(255,152,0,0.35)', outlineOffset: '1px' });
                    }
                }).on('mouseleave.m4', function() {
                    if (!$(this).data('m4-box-sel')) {
                        $(this).css('outline', 'none');
                    }
                });
            });
        },

        showBoxBar: function($box, wid) {
            var self = this;
            this.hideToolbar();
            $('.m-box-bar, .m-img-bar').remove();

            $box.data('m4-box-sel', true);
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
                flexWrap: 'wrap', maxWidth: '500px'
            }).on('mousedown', function(e) { e.preventDefault(); });

            var tag = $box.prop('tagName').toLowerCase();
            var $label = $('<span>').css({ color: '#FF9800', fontSize: '11px', fontWeight: '600', padding: '0 6px', fontFamily: 'monospace' }).text(tag);
            var s = function() { return self.createSep(); };

            // Duplicate
            var $dup = this.createBtn('⧉', 'نسخ');
            $dup.on('mousedown', function(e) {
                e.preventDefault();
                var $clone = $box.clone(true);
                $clone.removeData();
                $clone.find('*').removeData();
                $box.after($clone);
                setTimeout(function() {
                    var $w = $clone.closest('.momentum-html-output');
                    self.makeEditable($w, wid);
                    self.setupImages($w, wid);
                    self.setupLinks($w, wid);
                    self.setupBoxes($w, wid);
                }, 100);
                self.notify('تم النسخ');
            });

            // Delete
            var $del = this.createBtn('🗑', 'حذف');
            $del.css('background', '#5c1a1a');
            $del.on('mousedown', function(e) {
                e.preventDefault();
                if (confirm('حذف هذا العنصر؟')) {
                    $box.fadeOut(200, function() { $(this).remove(); });
                    $('.m-box-bar').remove();
                    self.notify('تم الحذف');
                }
            });

            // Padding
            var pad = parseInt($box.css('padding')) || 0;
            var $padD = this.createBtn('P−', 'Padding -');
            var $padL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '24px', textAlign: 'center', display: 'inline-block' }).text(pad);
            var $padU = this.createBtn('P+', 'Padding +');

            $padD.on('mousedown', function(e) {
                e.preventDefault();
                pad = Math.max(0, pad - 5);
                $box.css('padding', pad + 'px');
                $padL.text(pad);
            });
            $padU.on('mousedown', function(e) {
                e.preventDefault();
                pad += 5;
                $box.css('padding', pad + 'px');
                $padL.text(pad);
            });

            // Background color
            var $bgLabel = $('<span>').css({ color: '#aaa', fontSize: '10px' }).text('BG:');
            var $bgClr = $('<input type="color">').val(self.rgbToHex($box.css('background-color') || '#ffffff')).css({
                width: '28px', height: '24px', border: 'none', borderRadius: '4px',
                cursor: 'pointer', background: 'transparent', padding: '0'
            });
            $bgClr.on('input', function() {
                $box.css('background-color', $(this).val());
            });

            // Border radius
            var brd = parseInt($box.css('border-radius')) || 0;
            var $brdD = this.createBtn('R−', 'Radius -');
            var $brdL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '22px', textAlign: 'center', display: 'inline-block' }).text(brd);
            var $brdU = this.createBtn('R+', 'Radius +');

            $brdD.on('mousedown', function(e) {
                e.preventDefault();
                brd = Math.max(0, brd - 2);
                $box.css('border-radius', brd + 'px');
                $brdL.text(brd);
            });
            $brdU.on('mousedown', function(e) {
                e.preventDefault();
                brd += 2;
                $box.css('border-radius', brd + 'px');
                $brdL.text(brd);
            });

            $bar.append($label, s(), $dup, $del, s(), $padD, $padL, $padU, s(),
                        $bgLabel, $bgClr, s(), $brdD, $brdL, $brdU);
            $('body').append($bar);

            // Click elsewhere to deselect
            $(document).on('click.mboxdesel4', function(e) {
                if (!$(e.target).closest('.m-box-bar').length && !$(e.target).is($box[0])) {
                    $box.removeData('m4-box-sel').css('outline', 'none');
                    $('.m-box-bar').remove();
                    $(document).off('click.mboxdesel4');
                }
            });
        },

        // ============================================
        // UTILITY FUNCTIONS
        // ============================================
        createBtn: function(text, title, active) {
            return $('<button type="button">').text(text).attr('title', title || '').css({
                background: active ? '#6C63FF' : '#2a2a3e',
                color: '#fff', border: 'none', borderRadius: '6px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
                fontFamily: 'sans-serif', minWidth: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s'
            }).on('mouseenter', function() {
                if ($(this).css('background-color') !== 'rgb(108, 99, 255)') {
                    $(this).css('background', '#333');
                }
            }).on('mouseleave', function() {
                if ($(this).css('background-color') === 'rgb(51, 51, 51)') {
                    $(this).css('background', '#2a2a3e');
                }
            });
        },

        createSep: function() {
            return $('<div>').css({
                width: '1px', height: '20px', background: '#333',
                margin: '0 2px', flexShrink: '0'
            });
        },

        rgbToHex: function(rgb) {
            if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
            if (rgb.charAt(0) === '#') return rgb;
            var match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return '#ffffff';
            return '#' + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1);
        },

        escAttr: function(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    // Backup init
    setTimeout(function() { M.tryInit(); }, 2000);

})(jQuery);
