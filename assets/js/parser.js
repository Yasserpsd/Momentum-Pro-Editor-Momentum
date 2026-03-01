(function($) {
    'use strict';

    /**
     * Momentum Pro Editor v3.0 - Full Inline Editor
     * Runs inside the Elementor preview iframe
     */

    var M = {

        mods: {},
        history: {},
        histIdx: {},
        maxH: 50,
        ready: false,

        // ============================================
        // INIT
        // ============================================
        init: function() {
            if (this.ready) return;
            if (!$('body').hasClass('elementor-editor-active')) return;
            this.ready = true;
            this.setup();
            this.watch();
            console.log('Momentum v3.0: Active');
        },

        setup: function() {
            var self = this;
            $('.momentum-html-output').each(function() {
                var $w = $(this);
                if ($w.data('m3')) return;
                $w.data('m3', true);

                var wid = $w.data('widget-id');
                if (!wid) return;

                if (!self.mods[wid]) self.mods[wid] = { texts: {}, images: {}, links: {}, boxes: {} };
                if (!self.history[wid]) { self.history[wid] = []; self.histIdx[wid] = -1; }

                self.scanTexts($w, wid);
                self.scanImages($w, wid);
                self.scanLinks($w, wid);
                self.scanBoxes($w, wid);
                self.setupKeys(wid);
                self.addBadge($w);
            });
        },

        // ============================================
        // DEEP TEXT SCAN - finds ALL text elements
        // ============================================
        scanTexts: function($w, wid) {
            var self = this;

            // Get ALL elements that could contain text
            $w.find('*').each(function() {
                var el = this;
                var $el = $(this);

                // Skip already processed
                if ($el.data('m-t3')) return;

                // Skip non-text elements
                var tag = el.tagName.toLowerCase();
                var skipTags = ['script', 'style', 'svg', 'path', 'circle', 'rect', 'line', 'polygon',
                    'polyline', 'ellipse', 'g', 'defs', 'clippath', 'use', 'symbol',
                    'br', 'hr', 'img', 'input', 'select', 'textarea', 'video', 'audio',
                    'canvas', 'iframe', 'object', 'embed', 'noscript', 'template'];
                if (skipTags.indexOf(tag) !== -1) return;

                // Skip momentum UI elements
                if ($el.hasClass('m-badge') || $el.closest('#m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar').length) return;

                // Skip icon elements
                if (self.isIcon(el)) return;

                // Check if element has DIRECT text content
                var hasDirectText = false;
                var directText = '';
                for (var i = 0; i < el.childNodes.length; i++) {
                    var node = el.childNodes[i];
                    if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                        hasDirectText = true;
                        directText += node.textContent.trim();
                    }
                }

                if (!hasDirectText) return;
                if (directText.length === 0) return;

                // Skip if text is only 1-2 chars and likely an icon
                if (directText.length <= 2 && $el.find('svg, i[class], [class*="icon"]').length > 0) return;

                $el.data('m-t3', true);
                $el.attr('contenteditable', 'true');
                $el.css({ 'cursor': 'text', 'outline': 'none' });

                // Prevent link clicks
                if (tag === 'a') {
                    $el.on('click.m', function(e) { e.preventDefault(); });
                }

                // Hover
                $el.on('mouseenter.m', function(e) {
                    e.stopPropagation();
                    if (!$(this).is(':focus')) {
                        $(this).css({ 'outline': '2px dashed rgba(108,99,255,0.4)', 'outline-offset': '2px' });
                    }
                }).on('mouseleave.m', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css('outline', 'none');
                    }
                });

                // Focus
                $el.on('focus.m', function(e) {
                    e.stopPropagation();
                    $(this).css({ 'outline': '2px solid #6C63FF', 'outline-offset': '3px' });
                    self.showTextToolbar($(this), wid);
                });

                // Blur
                $el.on('blur.m', function() {
                    $(this).css('outline', 'none');
                    self.saveText($(this), wid);
                    setTimeout(function() { self.maybeHide(); }, 300);
                });

                // Input
                $el.on('input.m', function() {
                    self.saveText($(this), wid);
                });
            });
        },

        isIcon: function(el) {
            var $el = $(el);
            var tag = el.tagName.toLowerCase();

            if (tag === 'svg' || tag === 'i') {
                var text = $el.text().trim();
                if (text.length <= 1) return true;
            }

            if ($el.find('svg').length > 0 && $el.children().length > 0) {
                var textOnly = '';
                for (var i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 3) textOnly += el.childNodes[i].textContent.trim();
                }
                if (textOnly.length <= 2) return true;
            }

            var cls = (el.className || '').toString();
            if (/\b(fa|fas|far|fab|fal|fad|dashicons|eicon|ti-|glyphicon|material-icons|icon)\b/i.test(cls)) return true;

            return false;
        },

        saveText: function($el, wid) {
            var key = this.getKey($el, wid);
            if (!this.mods[wid].texts[key]) this.mods[wid].texts[key] = {};

            var text = '';
            for (var i = 0; i < $el[0].childNodes.length; i++) {
                if ($el[0].childNodes[i].nodeType === 3) text += $el[0].childNodes[i].textContent;
            }
            this.mods[wid].texts[key].text = text.trim() || $el.text().trim();
            this.pushH(wid);
            this.save(wid);
        },

        // ============================================
        // TEXT TOOLBAR (Enhanced)
        // ============================================
        showTextToolbar: function($el, wid) {
            var self = this;
            this.hideAll();

            var off = $el.offset();
            var $bar = this.createBar(off, $el);

            // --- BOLD ---
            var $b = this.btn('B', 'عريض', this.isBold($el)).css('font-weight', 'bold');
            $b.on('mousedown', function(e) {
                e.preventDefault();
                var on = self.isBold($el);
                $el.css('font-weight', on ? 'normal' : 'bold');
                $(this).css('background', on ? '#2a2a3e' : '#6C63FF');
                self.saveSty($el, wid, 'fontWeight', on ? 'normal' : 'bold');
            });

            // --- ITALIC ---
            var $i = this.btn('I', 'مائل', $el.css('font-style') === 'italic').css('font-style', 'italic');
            $i.on('mousedown', function(e) {
                e.preventDefault();
                var on = $el.css('font-style') === 'italic';
                $el.css('font-style', on ? 'normal' : 'italic');
                $(this).css('background', on ? '#2a2a3e' : '#6C63FF');
                self.saveSty($el, wid, 'fontStyle', on ? 'normal' : 'italic');
            });

            // --- UNDERLINE ---
            var $u = this.btn('U', 'تحته خط', $el.css('text-decoration').indexOf('underline') !== -1).css('text-decoration', 'underline');
            $u.on('mousedown', function(e) {
                e.preventDefault();
                var on = $el.css('text-decoration').indexOf('underline') !== -1;
                $el.css('text-decoration', on ? 'none' : 'underline');
                $(this).css('background', on ? '#2a2a3e' : '#6C63FF');
                self.saveSty($el, wid, 'textDecoration', on ? 'none' : 'underline');
            });

            // --- ALIGN ---
            var al = $el.css('text-align') || 'right';
            var $aR = this.btn('⫷', 'يمين', al === 'right' || al === 'start').attr('data-al', 'right');
            var $aC = this.btn('≡', 'وسط', al === 'center').attr('data-al', 'center');
            var $aL = this.btn('⫸', 'شمال', al === 'left' || al === 'end').attr('data-al', 'left');

            [$aR, $aC, $aL].forEach(function($btn) {
                $btn.on('mousedown', function(e) {
                    e.preventDefault();
                    var a = $(this).attr('data-al');
                    $el.css('text-align', a);
                    $bar.find('[data-al]').css('background', '#2a2a3e');
                    $(this).css('background', '#6C63FF');
                    self.saveSty($el, wid, 'textAlign', a);
                });
            });

            // --- FONT SIZE ---
            var sz = parseInt($el.css('font-size')) || 16;
            var $szD = this.btn('−', 'تصغير');
            var $szL = $('<span>').css({ color: '#fff', fontSize: '11px', minWidth: '36px', textAlign: 'center', userSelect: 'none' }).text(sz + 'px');
            var $szU = this.btn('+', 'تكبير');

            $szD.on('mousedown', function(e) {
                e.preventDefault();
                sz = Math.max(6, sz - 1);
                $el.css('font-size', sz + 'px');
                $szL.text(sz + 'px');
                self.saveSty($el, wid, 'fontSize', sz + 'px');
            });
            $szU.on('mousedown', function(e) {
                e.preventDefault();
                sz = Math.min(200, sz + 1);
                $el.css('font-size', sz + 'px');
                $szL.text(sz + 'px');
                self.saveSty($el, wid, 'fontSize', sz + 'px');
            });

            // --- LINE HEIGHT ---
            var lh = parseFloat($el.css('line-height')) / (parseInt($el.css('font-size')) || 16);
            lh = Math.round(lh * 10) / 10 || 1.5;
            var $lhD = this.btn('↕−', 'تقليل');
            var $lhL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '26px', textAlign: 'center' }).text(lh.toFixed(1));
            var $lhU = this.btn('↕+', 'زيادة');

            $lhD.on('mousedown', function(e) {
                e.preventDefault();
                lh = Math.max(0.5, Math.round((lh - 0.1) * 10) / 10);
                $el.css('line-height', lh);
                $lhL.text(lh.toFixed(1));
                self.saveSty($el, wid, 'lineHeight', String(lh));
            });
            $lhU.on('mousedown', function(e) {
                e.preventDefault();
                lh = Math.min(5, Math.round((lh + 0.1) * 10) / 10);
                $el.css('line-height', lh);
                $lhL.text(lh.toFixed(1));
                self.saveSty($el, wid, 'lineHeight', String(lh));
            });

            // --- COLORS ---
            var $clr = this.colorPick($el, 'color', 'لون النص', wid);
            var $bg = this.colorPick($el, 'background-color', 'لون الخلفية', wid);

            // --- LINK BUTTON ---
            var $link = this.btn('🔗', 'إضافة/تعديل رابط');
            $link.on('mousedown', function(e) {
                e.preventDefault();
                if ($el.is('a')) {
                    self.showLinkEditor($el, wid);
                } else {
                    self.wrapWithLink($el, wid);
                }
            });

            // --- UNDO / REDO ---
            var $undo = this.btn('↩', 'تراجع');
            $undo.on('mousedown', function(e) { e.preventDefault(); self.undo(wid); });
            var $redo = this.btn('↪', 'إعادة');
            $redo.on('mousedown', function(e) { e.preventDefault(); self.redo(wid); });

            // Build toolbar
            var s = function() { return self.sep(); };
            $bar.append($b, $i, $u, s(), $aR, $aC, $aL, s(), $szD, $szL, $szU, s(), $lhD, $lhL, $lhU, s(), $clr, $bg, s(), $link, s(), $undo, $redo);

            $('body').append($bar);
            this.fixPos($bar, off, $el);
        },

        // Wrap text/element with a link
        wrapWithLink: function($el, wid) {
            var self = this;
            var sel = window.getSelection();
            var selectedText = sel.toString().trim();

            // Show link editor popup
            this.showNewLinkEditor($el, wid, selectedText);
        },

        showNewLinkEditor: function($el, wid, selectedText) {
            var self = this;
            $('#m-link-editor').remove();

            var off = $el.offset();
            var is = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $el.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '300px', fontFamily: 'sans-serif'
            });

            $ed.on('mousedown', function(e) { e.stopPropagation(); });

            var defaultText = selectedText || $el.text().trim();

            $ed.html(
                '<div style="color:#6C63FF;font-weight:700;font-size:14px;margin-bottom:12px;">🔗 إضافة رابط</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" placeholder="https://example.com" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص<input type="text" id="ml-txt" value="' + defaultText + '" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank"> فتح في تاب جديد</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">💾 إضافة</button>' +
                '</div>'
            );

            $('body').append($ed);
            $ed.find('#ml-url').focus();

            $ed.find('#ml-ok').on('click', function() {
                var url = $ed.find('#ml-url').val();
                var txt = $ed.find('#ml-txt').val();
                var blank = $ed.find('#ml-blank').is(':checked');

                if (!url) { alert('اكتب URL الأول'); return; }

                // If element is already a link, just update it
                if ($el.is('a')) {
                    $el.attr('href', url);
                    if (txt) $el.text(txt);
                    if (blank) $el.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                } else {
                    // Wrap element content with <a>
                    var $a = $('<a>').attr('href', url).text(txt || $el.text());
                    if (blank) $a.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                    $a.css({ color: $el.css('color'), textDecoration: 'underline' });
                    $el.empty().append($a);

                    // Make the new link editable
                    $a.attr('contenteditable', 'true');
                    $a.on('click.m', function(e) { e.preventDefault(); });
                }

                self.pushH(wid);
                self.save(wid);
                $ed.remove();
                self.notify('✅ تم إضافة الرابط');
            });

            $ed.find('#ml-x').on('click', function() { $ed.remove(); });
        },

        // ============================================
        // LINK EDITOR (for existing links)
        // ============================================
        scanLinks: function($w, wid) {
            var self = this;
            $w.find('a').each(function() {
                var $a = $(this);
                if ($a.data('m-lk3')) return;
                $a.data('m-lk3', true);

                $a.on('dblclick.m', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.showLinkEditor($(this), wid);
                });
            });
        },

        showLinkEditor: function($a, wid) {
            var self = this;
            $('#m-link-editor').remove();

            var off = $a.offset();
            var is = 'width:100%;padding:8px 12px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#fff;font-size:13px;margin-top:4px;box-sizing:border-box;outline:none;';

            var $ed = $('<div id="m-link-editor">').css({
                position: 'absolute', zIndex: 999999,
                top: (off.top + $a.outerHeight() + 8) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                border: '1px solid rgba(108,99,255,0.3)',
                width: '300px', fontFamily: 'sans-serif'
            });

            $ed.on('mousedown', function(e) { e.stopPropagation(); });

            $ed.html(
                '<div style="color:#6C63FF;font-weight:700;font-size:14px;margin-bottom:12px;">🔗 تعديل الرابط</div>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">URL<input type="url" id="ml-url" value="' + ($a.attr('href') || '') + '" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:block;margin-bottom:10px;">النص<input type="text" id="ml-txt" value="' + $a.text().trim() + '" style="' + is + '"></label>' +
                '<label style="color:#aaa;font-size:11px;display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="ml-blank" ' + ($a.attr('target') === '_blank' ? 'checked' : '') + '> فتح في تاب جديد</label>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="ml-x" style="padding:7px 14px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer;">إلغاء</button>' +
                '<button id="ml-del" style="padding:7px 14px;border:none;border-radius:6px;background:#e74c3c;color:#fff;cursor:pointer;">🗑️ حذف</button>' +
                '<button id="ml-ok" style="padding:7px 14px;border:none;border-radius:6px;background:#6C63FF;color:#fff;cursor:pointer;font-weight:600;">💾 حفظ</button>' +
                '</div>'
            );

            $('body').append($ed);

            $ed.find('#ml-ok').on('click', function() {
                $a.attr('href', $ed.find('#ml-url').val());
                var t = $ed.find('#ml-txt').val();
                if (t) $a.text(t);
                if ($ed.find('#ml-blank').is(':checked')) {
                    $a.attr('target', '_blank').attr('rel', 'noopener noreferrer');
                } else {
                    $a.removeAttr('target').removeAttr('rel');
                }
                self.pushH(wid);
                self.save(wid);
                $ed.remove();
            });

            $ed.find('#ml-del').on('click', function() {
                var txt = $a.text();
                $a.replaceWith(txt);
                self.pushH(wid);
                self.save(wid);
                $ed.remove();
            });

            $ed.find('#ml-x').on('click', function() { $ed.remove(); });
        },

        // ============================================
        // BOX/CONTAINER CONTROLS
        // ============================================
        scanBoxes: function($w, wid) {
            var self = this;

            // Find all direct child containers
            $w.find('div, section, article, header, footer, ul, ol, table, blockquote, aside, nav, main').each(function() {
                var $box = $(this);
                if ($box.data('m-bx3')) return;
                if ($box.hasClass('momentum-html-output')) return;
                if ($box.closest('#m-toolbar, #m-link-editor, .m-img-bar, .m-box-bar').length) return;

                $box.data('m-bx3', true);

                // Right-click for box controls
                $box.on('contextmenu.m', function(e) {
                    // Only if right-clicked directly on this box (not a child)
                    if (e.target !== this && !$(e.target).is('div, section, article')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    self.showBoxBar($(this), wid);
                });

                // Hover outline
                $box.on('mouseenter.m', function(e) {
                    e.stopPropagation();
                    if (!$(this).data('m-bx-sel')) {
                        $(this).css({ 'outline': '1px dashed rgba(255,152,0,0.35)', 'outline-offset': '1px' });
                    }
                }).on('mouseleave.m', function() {
                    if (!$(this).data('m-bx-sel')) {
                        $(this).css('outline', 'none');
                    }
                });
            });
        },

        showBoxBar: function($box, wid) {
            var self = this;
            this.hideAll();

            $box.data('m-bx-sel', true);
            $box.css({ 'outline': '2px solid #FF9800', 'outline-offset': '2px' });

            var off = $box.offset();

            var $bar = $('<div class="m-box-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 48) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 8px',
                display: 'flex', gap: '4px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,152,0,0.4)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            // Tag label
            var tag = $box.prop('tagName').toLowerCase();
            var cls = $box.attr('class') || '';
            var label = tag + (cls ? '.' + cls.split(' ')[0] : '');
            if (label.length > 20) label = label.substring(0, 20) + '…';
            var $label = $('<span>').css({ color: '#FF9800', fontSize: '11px', fontWeight: '600', padding: '0 6px', fontFamily: 'monospace' }).text(label);

            var s = function() { return self.sep(); };

            // Move UP
            var $up = this.btn('⬆', 'نقل لفوق');
            $up.on('mousedown', function(e) {
                e.preventDefault();
                var $prev = $box.prev();
                if ($prev.length && !$prev.hasClass('m-badge')) {
                    $box.insertBefore($prev);
                    self.pushH(wid);
                    self.save(wid);
                    self.notify('⬆ تم النقل لفوق');
                    self.showBoxBar($box, wid);
                }
            });

            // Move DOWN
            var $down = this.btn('⬇', 'نقل لتحت');
            $down.on('mousedown', function(e) {
                e.preventDefault();
                var $next = $box.next();
                if ($next.length && !$next.hasClass('m-badge')) {
                    $box.insertAfter($next);
                    self.pushH(wid);
                    self.save(wid);
                    self.notify('⬇ تم النقل لتحت');
                    self.showBoxBar($box, wid);
                }
            });

            // DUPLICATE
            var $dup = this.btn('📋', 'نسخ');
            $dup.on('mousedown', function(e) {
                e.preventDefault();
                var $clone = $box.clone(true);
                $clone.removeData('m-bx3').removeData('m-bx-sel');
                $clone.find('*').removeData();
                $box.after($clone);

                // Re-scan
                setTimeout(function() {
                    self.scanTexts($clone.closest('.momentum-html-output'), wid);
                    self.scanImages($clone.closest('.momentum-html-output'), wid);
                    self.scanBoxes($clone.closest('.momentum-html-output'), wid);
                }, 100);

                self.pushH(wid);
                self.save(wid);
                self.notify('📋 تم النسخ');
            });

            // DELETE
            var $del = this.btn('🗑️', 'حذف');
            $del.css('background', '#5c1a1a');
            $del.on('mousedown', function(e) {
                e.preventDefault();
                if (confirm('متأكد إنك عايز تحذف البوكس ده؟')) {
                    $box.fadeOut(200, function() {
                        $(this).remove();
                        self.pushH(wid);
                        self.save(wid);
                        self.notify('🗑️ تم الحذف');
                    });
                    self.hideAll();
                }
            });

            // HIDE/SHOW
            var isHidden = $box.data('m-hidden');
            var $hide = this.btn(isHidden ? '👁️' : '🙈', isHidden ? 'إظهار' : 'إخفاء');
            $hide.on('mousedown', function(e) {
                e.preventDefault();
                if ($box.data('m-hidden')) {
                    $box.css('opacity', '1').removeData('m-hidden');
                    $(this).text('🙈');
                    self.notify('👁️ تم الإظهار');
                } else {
                    $box.css('opacity', '0.2').data('m-hidden', true);
                    $(this).text('👁️');
                    self.notify('🙈 تم الإخفاء');
                }
                self.pushH(wid);
                self.save(wid);
            });

            // PADDING control
            var pad = parseInt($box.css('padding')) || 0;
            var $padD = this.btn('P−', 'تقليل Padding');
            var $padL = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '24px', textAlign: 'center' }).text(pad);
            var $padU = this.btn('P+', 'زيادة Padding');

            $padD.on('mousedown', function(e) {
                e.preventDefault();
                pad = Math.max(0, pad - 5);
                $box.css('padding', pad + 'px');
                $padL.text(pad);
                self.saveSty($box, wid, 'padding', pad + 'px');
            });
            $padU.on('mousedown', function(e) {
                e.preventDefault();
                pad += 5;
                $box.css('padding', pad + 'px');
                $padL.text(pad);
                self.saveSty($box, wid, 'padding', pad + 'px');
            });

            // BG Color
            var $bgClr = this.colorPick($box, 'background-color', 'لون خلفية البوكس', wid);

            $bar.append($label, s(), $up, $down, s(), $dup, $del, $hide, s(), $padD, $padL, $padU, s(), $bgClr);
            $('body').append($bar);

            // Click elsewhere to deselect
            $(document).on('click.mboxdesel', function(e) {
                if (!$(e.target).closest('.m-box-bar').length && !$(e.target).is($box)) {
                    $box.removeData('m-bx-sel').css('outline', 'none');
                    $('.m-box-bar').remove();
                    $(document).off('click.mboxdesel');
                }
            });
        },

        // ============================================
        // IMAGE EDITING
        // ============================================
        scanImages: function($w, wid) {
            var self = this;
            $w.find('img').each(function(idx) {
                var $img = $(this);
                if ($img.data('m-i3')) return;
                $img.data('m-i3', true);
                $img.data('m-idx', idx);

                $img.css({ cursor: 'pointer', transition: 'outline 0.15s' });

                $img.on('mouseenter.m', function() {
                    if (!$(this).data('m-sel')) $(this).css({ 'outline': '3px solid rgba(108,99,255,0.5)', 'outline-offset': '3px' });
                }).on('mouseleave.m', function() {
                    if (!$(this).data('m-sel')) $(this).css('outline', 'none');
                });

                $img.on('click.m', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.selectImg($(this), wid);
                });
            });
        },

        selectImg: function($img, wid) {
            var self = this;
            $('[data-m-sel]').removeData('m-sel').css('outline', 'none');
            $('.m-img-bar,.m-resize-h').remove();
            this.hideAll();

            $img.data('m-sel', true);
            $img.css({ 'outline': '3px solid #6C63FF', 'outline-offset': '3px' });

            var off = $img.offset(), w = $img.width(), h = $img.height();

            // Resize handle
            var $rh = $('<div class="m-resize-h">').css({
                position: 'absolute', width: '14px', height: '14px',
                background: '#6C63FF', borderRadius: '3px', cursor: 'nwse-resize', zIndex: 999998,
                top: (off.top + h - 7) + 'px', left: (off.left + w - 7) + 'px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            });
            $('body').append($rh);

            var sx, sw, sh, ratio;
            $rh.on('mousedown', function(e) {
                e.preventDefault();
                sx = e.pageX; sw = $img.width(); sh = $img.height(); ratio = sw / sh;
                $(document).on('mousemove.mr', function(e2) {
                    var nw = Math.max(30, sw + (e2.pageX - sx));
                    var nh = Math.round(nw / ratio);
                    $img.css({ width: nw + 'px', height: nh + 'px' }).attr({ width: nw, height: nh });
                    var no = $img.offset();
                    $rh.css({ top: (no.top + nh - 7) + 'px', left: (no.left + nw - 7) + 'px' });
                    $('.m-img-bar .m-sz').text(nw + '×' + nh);
                });
                $(document).on('mouseup.mr', function() {
                    $(document).off('mousemove.mr mouseup.mr');
                    self.saveImg($img, wid);
                });
            });

            // Image toolbar
            var $bar = $('<div class="m-img-bar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 48) + 'px', left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '10px', padding: '5px 10px',
                display: 'flex', gap: '6px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid rgba(108,99,255,0.3)'
            }).on('mousedown', function(e) { e.preventDefault(); });

            var $rep = this.btn('📷', 'تغيير');
            $rep.on('mousedown', function(e) {
                e.preventDefault();
                self.pickImg($img, wid);
            });

            var $sz = $('<span class="m-sz">').css({ color: '#aaa', fontSize: '11px', padding: '0 6px' }).text(Math.round(w) + '×' + Math.round(h));

            var rad = parseInt($img.css('border-radius')) || 0;
            var $rd = this.btn('◻', 'حاد');
            var $rl = $('<span>').css({ color: '#aaa', fontSize: '10px', minWidth: '20px', textAlign: 'center' }).text(rad);
            var $ru = this.btn('◯', 'دائري');

            $rd.on('mousedown', function(e) { e.preventDefault(); rad = Math.max(0, rad - 2); $img.css('border-radius', rad + 'px'); $rl.text(rad); self.saveImg($img, wid); });
            $ru.on('mousedown', function(e) { e.preventDefault(); rad += 2; $img.css('border-radius', rad + 'px'); $rl.text(rad); self.saveImg($img, wid); });

            $bar.append($rep, this.sep(), $sz, this.sep(), $rd, $rl, $ru);
            $('body').append($bar);

            $(document).on('click.mid', function(e) {
                if (!$(e.target).is($img) && !$(e.target).closest('.m-img-bar,.m-resize-h').length) {
                    $img.removeData('m-sel').css('outline', 'none');
                    $('.m-img-bar,.m-resize-h').remove();
                    $(document).off('click.mid');
                }
            });
        },

        pickImg: function($img, wid) {
            var self = this;
            if (typeof wp === 'undefined' || !wp.media) { alert('مكتبة الوسائط مش متاحة'); return; }

            var f = wp.media({ title: '📷 اختر صورة', button: { text: 'استخدم' }, multiple: false, library: { type: 'image' } });
            f.on('select', function() {
                var a = f.state().get('selection').first().toJSON();
                $img.attr('src', a.url);
                self.saveImg($img, wid);
                setTimeout(function() { self.selectImg($img, wid); }, 100);
            });
            f.open();
        },

        saveImg: function($img, wid) {
            var idx = $img.data('m-idx') || 0;
            this.mods[wid].images = this.mods[wid].images || {};
            this.mods[wid].images[idx] = {
                src: $img.attr('src'),
                width: Math.round($img.width()),
                height: Math.round($img.height()),
                borderRadius: parseInt($img.css('border-radius')) || 0
            };
            this.pushH(wid);
            this.save(wid);
        },

        // ============================================
        // HELPERS
        // ============================================
        createBar: function(off, $el) {
            var $bar = $('<div id="m-toolbar">').css({
                position: 'absolute', zIndex: 999999,
                top: Math.max(5, off.top - 52) + 'px',
                left: Math.max(10, off.left) + 'px',
                background: '#1a1a2e', borderRadius: '12px', padding: '5px 6px',
                display: 'flex', gap: '3px', alignItems: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                border: '1px solid rgba(108,99,255,0.3)',
                flexWrap: 'wrap', maxWidth: '560px'
            }).on('mousedown', function(e) {
                if (!$(e.target).is('input')) e.preventDefault();
            });
            return $bar;
        },

        fixPos: function($bar, off, $el) {
            setTimeout(function() {
                var bw = $bar.outerWidth(), ww = $(window).width();
                if (parseInt($bar.css('left')) + bw > ww - 20) $bar.css('left', Math.max(10, ww - bw - 20) + 'px');
                if (off.top - 52 < 5) $bar.css('top', (off.top + $el.outerHeight() + 8) + 'px');
            }, 10);
        },

        btn: function(text, title, active) {
            return $('<button>').text(text).attr('title', title).css({
                background: active ? '#6C63FF' : '#2a2a3e', color: '#fff',
                border: 'none', borderRadius: '6px', width: '28px', height: '28px',
                cursor: 'pointer', fontSize: '12px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s', flexShrink: 0
            });
        },

        sep: function() {
            return $('<div>').css({ width: '1px', height: '22px', background: '#333', flexShrink: 0 });
        },

        colorPick: function($el, prop, title, wid) {
            var self = this;
            var cur = self.toHex($el.css(prop));
            var isTrans = ($el.css(prop) === 'rgba(0, 0, 0, 0)' || $el.css(prop) === 'transparent');
            return $('<input type="color">').val(isTrans ? '#ffffff' : (cur || '#333333')).css({
                width: '28px', height: '28px', border: '2px solid #444',
                borderRadius: '6px', cursor: 'pointer', padding: '0', background: 'none', flexShrink: 0
            }).attr('title', title).on('input', function() {
                var camelProp = prop.replace(/-([a-z])/g, function(m, c) { return c.toUpperCase(); });
                $el.css(prop, $(this).val());
                self.saveSty($el, wid, camelProp, $(this).val());
            });
        },

        isBold: function($el) {
            var fw = $el.css('font-weight');
            return fw === '700' || fw === 'bold' || parseInt(fw) >= 600;
        },

        saveSty: function($el, wid, prop, val) {
            var key = this.getKey($el, wid);
            if (!this.mods[wid].texts[key]) this.mods[wid].texts[key] = {};
            this.mods[wid].texts[key][prop] = val;
            this.pushH(wid);
            this.save(wid);
        },

        getKey: function($el, wid) {
            var tag = $el.prop('tagName').toLowerCase();
            var $w = $el.closest('.momentum-html-output');
            return tag + ':' + $w.find(tag).index($el);
        },

        toHex: function(rgb) {
            if (!rgb) return '#333333';
            if (rgb.charAt(0) === '#') return rgb;
            var m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!m) return '#333333';
            return '#' + ((1 << 24) + (+m[1] << 16) + (+m[2] << 8) + +m[3]).toString(16).slice(1);
        },

        maybeHide: function() {
            var $f = $(':focus');
            if ($f.closest('#m-toolbar, #m-link-editor').length) return;
            if ($f.attr('contenteditable') === 'true') return;
            this.hideAll();
        },

        hideAll: function() {
            $('#m-toolbar, #m-link-editor').remove();
        },

        // ============================================
        // UNDO / REDO
        // ============================================
        setupKeys: function(wid) {
            if ($(document).data('m-k3')) return;
            $(document).data('m-k3', true);
            var self = this;
            $(document).on('keydown.m', function(e) {
                var w = self.activeWid();
                if (!w) return;
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); self.undo(w); }
                if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); self.redo(w); }
            });
        },

        activeWid: function() {
            var $w = $('.momentum-html-output').first();
            return $w.length ? $w.data('widget-id') : null;
        },

        pushH: function(wid) {
            if (!this.history[wid]) { this.history[wid] = []; this.histIdx[wid] = -1; }
            var i = this.histIdx[wid];
            if (i < this.history[wid].length - 1) this.history[wid] = this.history[wid].slice(0, i + 1);
            this.history[wid].push(JSON.parse(JSON.stringify(this.mods[wid])));
            if (this.history[wid].length > this.maxH) this.history[wid].shift();
            this.histIdx[wid] = this.history[wid].length - 1;
        },

        undo: function(wid) {
            if (!this.history[wid] || this.histIdx[wid] <= 0) { this.notify('⚠️ مفيش تراجع'); return; }
            this.histIdx[wid]--;
            this.mods[wid] = JSON.parse(JSON.stringify(this.history[wid][this.histIdx[wid]]));
            this.save(wid);
            this.notify('↩ تراجع');
        },

        redo: function(wid) {
            if (!this.history[wid] || this.histIdx[wid] >= this.history[wid].length - 1) { this.notify('⚠️ مفيش إعادة'); return; }
            this.histIdx[wid]++;
            this.mods[wid] = JSON.parse(JSON.stringify(this.history[wid][this.histIdx[wid]]));
            this.save(wid);
            this.notify('↪ إعادة');
        },

        // ============================================
        // SAVE
        // ============================================
        save: function(wid) {
            try {
                window.parent.postMessage({ type: 'momentum-save', widgetId: wid, modifications: this.mods[wid] }, '*');
            } catch(e) {}
        },

        notify: function(msg) {
            var $n = $('<div>').css({
                position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                background: '#1a1a2e', color: '#fff', padding: '10px 24px', borderRadius: '10px',
                fontSize: '13px', zIndex: 999999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                border: '1px solid rgba(108,99,255,0.3)'
            }).text(msg);
            $('body').append($n);
            setTimeout(function() { $n.fadeOut(300, function() { $n.remove(); }); }, 2000);
        },

        addBadge: function($w) {
            $w.on('mouseenter', function() {
                if ($(this).find('.m-badge').length) return;
                $(this).css('position', 'relative').append(
                    $('<div class="m-badge">').css({
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'linear-gradient(135deg,#6C63FF,#4CAF50)',
                        color: '#fff', padding: '5px 14px', borderRadius: '20px',
                        fontSize: '11px', fontFamily: 'sans-serif', zIndex: 9999,
                        pointerEvents: 'none', boxShadow: '0 2px 12px rgba(108,99,255,0.4)'
                    }).html('✏️ <b>Momentum</b> — كليك يمين على أي بوكس للتحكم')
                );
            }).on('mouseleave', function() { $(this).find('.m-badge').remove(); });
        },

        watch: function() {
            var self = this;
            new MutationObserver(function(muts) {
                var found = false;
                muts.forEach(function(m) {
                    $(m.addedNodes).each(function() {
                        if ($(this).find('.momentum-html-output').length || $(this).hasClass('momentum-html-output')) found = true;
                    });
                });
                if (found) setTimeout(function() { self.setup(); }, 500);
            }).observe(document.body, { childList: true, subtree: true });
            setInterval(function() { self.setup(); }, 4000);
        }
    };

    $(document).ready(function() { setTimeout(function() { M.init(); }, 800); });
    window.MomentumPreview = M;

})(jQuery);
