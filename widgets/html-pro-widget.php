<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Momentum_HTML_Pro_Widget extends \Elementor\Widget_Base {

    public function get_name() {
        return 'momentum_html_pro';
    }

    public function get_title() {
        return esc_html__( 'Momentum Pro Editor', 'momentum-pro-editor' );
    }

    public function get_icon() {
        return 'eicon-code';
    }

    public function get_categories() {
        return [ 'momentum-pro' ];
    }

    public function get_keywords() {
        return [ 'html', 'code', 'momentum', 'pro', 'editor', 'custom', 'inline' ];
    }

    protected function register_controls() {

        // ============================================
        // TAB: HTML CODE
        // ============================================
        $this->start_controls_section(
            'section_html_code',
            [
                'label' => esc_html__( '📌 كود HTML', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'html_code',
            [
                'label'       => esc_html__( 'الكود', 'momentum-pro-editor' ),
                'type'        => \Elementor\Controls_Manager::CODE,
                'language'    => 'html',
                'rows'        => 20,
                'default'     => '<div style="padding:40px; text-align:center;">
    <h1 style="color:#333; font-size:36px; margin-bottom:15px;">مرحباً بيك في Momentum Pro Editor</h1>
    <p style="color:#666; font-size:18px; margin-bottom:25px;">اضغط على أي نص عشان تعدله مباشرة</p>
    <a href="https://example.com" style="background:#6C63FF; color:#fff; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:16px;">اضغط هنا</a>
    <img src="https://via.placeholder.com/600x300/6C63FF/ffffff?text=Momentum+Pro" alt="صورة تجريبية" width="600" height="300" style="margin-top:25px; border-radius:12px;">
    <p style="color:#999; font-size:14px; margin-top:20px;">اضغط مرتين على أي رابط عشان تعدله 🔗</p>
</div>',
            ]
        );

        $this->add_control(
            'sync_code_button',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="margin-top:10px;">
                    <button type="button" id="momentum-sync-btn" onclick="momentumSyncToCode()" style="background:linear-gradient(135deg,#4CAF50,#2E7D32);color:#fff;padding:12px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;width:100%;box-shadow:0 2px 10px rgba(76,175,80,0.3);transition:all 0.2s;">🔄 مزامنة التعديلات مع الكود</button>
                    <p style="color:#888;font-size:11px;text-align:center;margin-top:6px;">بيحدّث الكود HTML بكل التغييرات اللي عملتها بصرياً</p>
                </div>',
            ]
        );

        $this->add_control(
            'auto_sync',
            [
                'label'        => esc_html__( 'مزامنة تلقائية', 'momentum-pro-editor' ),
                'type'         => \Elementor\Controls_Manager::SWITCHER,
                'label_on'     => esc_html__( 'On', 'momentum-pro-editor' ),
                'label_off'    => esc_html__( 'Off', 'momentum-pro-editor' ),
                'return_value' => 'yes',
                'default'      => '',
                'description'  => esc_html__( 'لما تفعّلها، أي تعديل بيتحفظ في الكود تلقائياً', 'momentum-pro-editor' ),
            ]
        );

        $this->add_control(
            'usage_guide',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="background:linear-gradient(135deg,#6C63FF,#4CAF50);color:#fff;padding:16px;border-radius:10px;margin-top:10px;line-height:1.8;">
                    <strong style="font-size:14px;">💡 طريقة الاستخدام:</strong><br>
                    ✏️ اضغط على أي <strong>نص</strong> عشان تعدله مباشرة<br>
                    🎨 غيّر <strong>الألوان والخطوط</strong> من الـ Toolbar<br>
                    📌 اضغط <strong>زرار الدبوس</strong> عشان الـ Toolbar يفضل مفتوح<br>
                    📷 اضغط على أي <strong>صورة</strong> عشان تغيرها<br>
                    🔗 اضغط مرتين على أي <strong>رابط</strong> عشان تعدله<br>
                    🖱️ كليك يمين على أي <strong>Box</strong> لأدوات متقدمة<br>
                    ↩️ <strong>Ctrl+Z</strong> للتراجع | <strong>Ctrl+Y</strong> للإعادة<br>
                    🔄 اضغط <strong>مزامنة</strong> عشان التعديلات تنعكس على الكود<br>
                    <small style="opacity:0.8;">كل التعديلات بتتحفظ تلقائياً ✅</small>
                </div>',
            ]
        );

        $this->end_controls_section();

        // ============================================
        // TAB: MODIFICATIONS STORAGE (hidden)
        // ============================================
        $this->start_controls_section(
            'section_mods',
            [
                'label' => esc_html__( '💾 التعديلات', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'saved_modifications',
            [
                'label'   => '',
                'type'    => \Elementor\Controls_Manager::HIDDEN,
                'default' => '{}',
            ]
        );

        $this->add_control(
            'mods_info',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="text-align:center;padding:15px;">
                    <p style="color:#888;font-size:13px;margin-bottom:12px;">التعديلات بتتحفظ تلقائياً</p>
                    <button type="button" onclick="momentumResetModifications()" style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 10px rgba(231,76,60,0.3);">🔄 إعادة تعيين كل التعديلات</button>
                </div>',
            ]
        );

        $this->end_controls_section();

        // ============================================
        // STYLE: SPACING
        // ============================================
        $this->start_controls_section(
            'section_spacing',
            [
                'label' => esc_html__( '📏 المسافات', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'container_padding',
            [
                'label'      => esc_html__( 'Padding', 'momentum-pro-editor' ),
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', '%', 'em' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'container_margin',
            [
                'label'      => esc_html__( 'Margin', 'momentum-pro-editor' ),
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', '%', 'em' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'margin: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'container_bg',
            [
                'label'     => esc_html__( 'لون الخلفية', 'momentum-pro-editor' ),
                'type'      => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '{{WRAPPER}} .momentum-html-output' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'container_radius',
            [
                'label'      => esc_html__( 'حواف دائرية', 'momentum-pro-editor' ),
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', '%' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_group_control(
            \Elementor\Group_Control_Box_Shadow::get_type(),
            [
                'name'     => 'container_shadow',
                'selector' => '{{WRAPPER}} .momentum-html-output',
            ]
        );

        $this->end_controls_section();

        // ============================================
        // STYLE: CUSTOM CSS
        // ============================================
        $this->start_controls_section(
            'section_css',
            [
                'label' => esc_html__( '🎨 CSS إضافي', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'custom_css',
            [
                'label'    => esc_html__( 'CSS', 'momentum-pro-editor' ),
                'type'     => \Elementor\Controls_Manager::CODE,
                'language' => 'css',
                'rows'     => 10,
                'default'  => '',
            ]
        );

        $this->end_controls_section();
    }

    // ============================================
    // RENDER
    // ============================================
    protected function render() {
        $settings   = $this->get_settings_for_display();
        $html_code  = $settings['html_code'] ?? '';
        $custom_css = $settings['custom_css'] ?? '';
        $saved_mods = $settings['saved_modifications'] ?? '{}';
        $auto_sync  = $settings['auto_sync'] ?? '';
        $widget_id  = $this->get_id();
        $is_editor  = \Elementor\Plugin::$instance->editor->is_edit_mode();

        if ( empty( $html_code ) ) {
            if ( $is_editor ) {
                echo '<div class="momentum-html-output" data-widget-id="' . esc_attr( $widget_id ) . '" style="padding:50px;text-align:center;background:#f8f9fa;border:2px dashed #ddd;border-radius:12px;">';
                echo '<p style="color:#999;font-size:18px;">📝 حط كود HTML في تاب "كود HTML" عشان يظهر هنا</p>';
                echo '</div>';
            }
            return;
        }

        // Apply saved modifications to HTML
        $mods = json_decode( $saved_mods, true );
        if ( ! empty( $mods ) && is_array( $mods ) ) {
            $html_code = $this->apply_mods_internal( $html_code, $mods );
        }

        $editor_class = $is_editor ? ' momentum-editable' : '';

        echo '<div class="momentum-html-output' . $editor_class . '" data-widget-id="' . esc_attr( $widget_id ) . '" data-mods="' . esc_attr( $saved_mods ) . '" data-auto-sync="' . esc_attr( $auto_sync ) . '" data-original-html="' . esc_attr( base64_encode( $settings['html_code'] ?? '' ) ) . '">';

        if ( ! empty( $custom_css ) ) {
            echo '<style>' . wp_strip_all_tags( $custom_css ) . '</style>';
        }

        echo $html_code;
        echo '</div>';
    }

    /**
     * Public wrapper for AJAX
     */
    public function public_apply_mods( $html, $mods ) {
        return $this->apply_mods_internal( $html, $mods );
    }

    // ============================================
    // APPLY MODIFICATIONS SERVER-SIDE
    // ============================================
    private function apply_mods_internal( $html, $mods ) {
        if ( empty( $mods ) ) return $html;

        $dom = new \DOMDocument();
        libxml_use_internal_errors( true );

        $flags = LIBXML_HTML_NOIMPLIED;
        if ( defined( 'LIBXML_HTML_NODEFDTD' ) ) {
            $flags |= LIBXML_HTML_NODEFDTD;
        }

        $wrapped = '<div id="m-r">' . $html . '</div>';
        $dom->loadHTML( '<?xml encoding="UTF-8">' . $wrapped, $flags );
        libxml_clear_errors();

        $xpath = new \DOMXPath( $dom );

        $allowed = [
            'h1','h2','h3','h4','h5','h6','p','span','a','li','td','th',
            'label','button','strong','em','b','i','small','blockquote',
            'div','section','article','header','footer'
        ];

        // --- Text & Style ---
        if ( ! empty( $mods['texts'] ) && is_array( $mods['texts'] ) ) {
            foreach ( $mods['texts'] as $selector => $data ) {
                $parts = explode( ':', $selector );
                if ( count( $parts ) !== 2 ) continue;

                $tag   = strtolower( trim( $parts[0] ) );
                $index = intval( $parts[1] );

                if ( ! in_array( $tag, $allowed, true ) ) continue;

                $elements = $xpath->query( '//' . $tag );
                if ( ! $elements || $elements->length === 0 ) continue;

                $counter = 0;
                foreach ( $elements as $el ) {
                    if ( $counter === $index ) {
                        // Text
                        if ( isset( $data['text'] ) ) {
                            $has_child_elements = false;
                            foreach ( $el->childNodes as $ch ) {
                                if ( $ch->nodeType === XML_ELEMENT_NODE ) {
                                    $has_child_elements = true;
                                    break;
                                }
                            }
                            if ( ! $has_child_elements ) {
                                $el->nodeValue = '';
                                $el->appendChild( $dom->createTextNode( $data['text'] ) );
                            }
                        }

                        // Styles
                        $style = $el->getAttribute( 'style' ) ?: '';

                        $style_map = [
                            'color'           => 'color',
                            'fontSize'        => 'font-size',
                            'fontWeight'      => 'font-weight',
                            'fontStyle'       => 'font-style',
                            'textDecoration'  => 'text-decoration',
                            'textAlign'       => 'text-align',
                            'lineHeight'      => 'line-height',
                            'letterSpacing'   => 'letter-spacing',
                            'backgroundColor' => 'background-color',
                            'padding'         => 'padding',
                            'opacity'         => 'opacity',
                            'textTransform'   => 'text-transform',
                            'borderRadius'    => 'border-radius',
                            'border'          => 'border',
                            'margin'          => 'margin',
                            'boxShadow'       => 'box-shadow',
                        ];

                        foreach ( $style_map as $js_prop => $css_prop ) {
                            if ( isset( $data[ $js_prop ] ) && $data[ $js_prop ] !== '' ) {
                                $style = preg_replace(
                                    '/' . preg_quote( $css_prop, '/' ) . '\s*:[^;]+;?/',
                                    '',
                                    $style
                                );
                                $val = sanitize_text_field( $data[ $js_prop ] );
                                $style = rtrim( $style, '; ' ) . ';' . $css_prop . ':' . $val;
                            }
                        }

                        $style = trim( $style, '; ' );
                        if ( $style ) {
                            $el->setAttribute( 'style', $style );
                        }

                        break;
                    }
                    $counter++;
                }
            }
        }

        // --- Images ---
        if ( ! empty( $mods['images'] ) && is_array( $mods['images'] ) ) {
            $images = $xpath->query( '//img' );

            foreach ( $mods['images'] as $idx => $data ) {
                $index   = intval( $idx );
                $counter = 0;

                foreach ( $images as $img ) {
                    if ( $counter === $index ) {
                        if ( ! empty( $data['src'] ) ) {
                            $img->setAttribute( 'src', esc_url( $data['src'] ) );
                        }

                        $style = $img->getAttribute( 'style' ) ?: '';

                        if ( isset( $data['width'] ) && $data['width'] > 0 ) {
                            $img->setAttribute( 'width', intval( $data['width'] ) );
                            $style = preg_replace( '/width\s*:[^;]+;?/', '', $style );
                            $style = rtrim( $style, '; ' ) . ';width:' . intval( $data['width'] ) . 'px';
                        }

                        if ( isset( $data['height'] ) && $data['height'] > 0 ) {
                            $img->setAttribute( 'height', intval( $data['height'] ) );
                            $style = preg_replace( '/height\s*:[^;]+;?/', '', $style );
                            $style = rtrim( $style, '; ' ) . ';height:' . intval( $data['height'] ) . 'px';
                        }

                        if ( isset( $data['borderRadius'] ) ) {
                            $style = preg_replace( '/border-radius\s*:[^;]+;?/', '', $style );
                            $style = rtrim( $style, '; ' ) . ';border-radius:' . intval( $data['borderRadius'] ) . 'px';
                        }

                        if ( isset( $data['opacity'] ) ) {
                            $style = preg_replace( '/opacity\s*:[^;]+;?/', '', $style );
                            $style = rtrim( $style, '; ' ) . ';opacity:' . floatval( $data['opacity'] );
                        }

                        if ( isset( $data['boxShadow'] ) ) {
                            $style = preg_replace( '/box-shadow\s*:[^;]+;?/', '', $style );
                            $style = rtrim( $style, '; ' ) . ';box-shadow:' . sanitize_text_field( $data['boxShadow'] );
                        }

                        $style = trim( $style, '; ' );
                        if ( $style ) {
                            $img->setAttribute( 'style', $style );
                        }

                        break;
                    }
                    $counter++;
                }
            }
        }

        // --- Links ---
        if ( ! empty( $mods['links'] ) && is_array( $mods['links'] ) ) {
            $links = $xpath->query( '//a' );

            foreach ( $mods['links'] as $selector => $data ) {
                $parts = explode( ':', $selector );
                if ( count( $parts ) !== 2 ) continue;

                $index   = intval( $parts[1] );
                $counter = 0;

                foreach ( $links as $link ) {
                    if ( $counter === $index ) {
                        if ( ! empty( $data['href'] ) ) {
                            $link->setAttribute( 'href', esc_url( $data['href'] ) );
                        }
                        if ( isset( $data['target'] ) && $data['target'] === '_blank' ) {
                            $link->setAttribute( 'target', '_blank' );
                            $link->setAttribute( 'rel', 'noopener noreferrer' );
                        } elseif ( isset( $data['target'] ) ) {
                            $link->removeAttribute( 'target' );
                            $link->removeAttribute( 'rel' );
                        }
                        if ( isset( $data['text'] ) && ! empty( $data['text'] ) ) {
                            $has_children = false;
                            foreach ( $link->childNodes as $ch ) {
                                if ( $ch->nodeType === XML_ELEMENT_NODE ) {
                                    $has_children = true;
                                    break;
                                }
                            }
                            if ( ! $has_children ) {
                                $link->nodeValue = '';
                                $link->appendChild( $dom->createTextNode( $data['text'] ) );
                            }
                        }

                        // Apply styles to links too
                        if ( ! empty( $data['styles'] ) && is_array( $data['styles'] ) ) {
                            $style = $link->getAttribute( 'style' ) ?: '';
                            foreach ( $data['styles'] as $css_prop => $css_val ) {
                                $style = preg_replace(
                                    '/' . preg_quote( $css_prop, '/' ) . '\s*:[^;]+;?/',
                                    '',
                                    $style
                                );
                                $val = sanitize_text_field( $css_val );
                                $style = rtrim( $style, '; ' ) . ';' . $css_prop . ':' . $val;
                            }
                            $style = trim( $style, '; ' );
                            if ( $style ) {
                                $link->setAttribute( 'style', $style );
                            }
                        }

                        break;
                    }
                    $counter++;
                }
            }
        }

        // Get output from wrapper
        $root   = $dom->getElementById( 'm-r' );
        $output = '';
        if ( $root ) {
            foreach ( $root->childNodes as $child ) {
                $output .= $dom->saveHTML( $child );
            }
        }

        return $output ?: $html;
    }
}
