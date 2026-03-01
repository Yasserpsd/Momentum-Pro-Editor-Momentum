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
        return [ 'html', 'code', 'momentum', 'pro', 'editor', 'custom' ];
    }

    protected function register_controls() {

        // ============================================
        // TAB: HTML CODE INPUT
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
                'label'       => esc_html__( 'ادخل كود HTML هنا', 'momentum-pro-editor' ),
                'type'        => \Elementor\Controls_Manager::CODE,
                'language'    => 'html',
                'rows'        => 20,
                'default'     => '<div style="padding:30px; text-align:center;">
    <h1 style="color:#333; font-size:32px;">مرحباً بيك في Momentum Pro Editor</h1>
    <p style="color:#666; font-size:18px;">اضغط على أي نص عشان تعدله مباشرة</p>
    <img src="https://via.placeholder.com/600x300" alt="صورة تجريبية" width="600" height="300">
    <p style="color:#999; font-size:14px;">جرّب تضغط على النص ده وتعدله!</p>
</div>',
                'description' => esc_html__( 'حط كود HTML وبعدين في الـ Preview اضغط على أي نص عشان تعدله مباشرة', 'momentum-pro-editor' ),
            ]
        );

        $this->add_control(
            'enable_edit_notice',
            [
                'type'            => \Elementor\Controls_Manager::RAW_HTML,
                'raw'             => '<div style="background:linear-gradient(135deg,#6C63FF,#4CAF50);color:#fff;padding:15px;border-radius:8px;text-align:center;margin-top:10px;">
                    <strong>💡 طريقة الاستخدام:</strong><br><br>
                    1. حط كود HTML فوق ☝️<br>
                    2. روح على الـ Preview واضغط على أي نص<br>
                    3. عدّل النص مباشرة!<br>
                    4. اضغط على أي صورة عشان تغيرها<br><br>
                    <small>التعديلات بتتحفظ تلقائياً ✅</small>
                </div>',
                'content_classes' => 'momentum-usage-notice',
            ]
        );

        $this->end_controls_section();

        // ============================================
        // TAB: SAVED MODIFICATIONS
        // ============================================
        $this->start_controls_section(
            'section_modifications',
            [
                'label' => esc_html__( '💾 التعديلات المحفوظة', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'saved_modifications',
            [
                'label'   => esc_html__( 'بيانات التعديلات', 'momentum-pro-editor' ),
                'type'    => \Elementor\Controls_Manager::HIDDEN,
                'default' => '{}',
            ]
        );

        $this->add_control(
            'modifications_display',
            [
                'type'            => \Elementor\Controls_Manager::RAW_HTML,
                'raw'             => '<div style="background:#f5f5f5;padding:15px;border-radius:8px;text-align:center;color:#999;">
                    <p>التعديلات بتتحفظ تلقائياً لما تعدل في الـ Preview</p>
                    <button type="button" onclick="momentumResetModifications()" style="background:#e74c3c;color:#fff;padding:8px 16px;border:none;border-radius:5px;cursor:pointer;margin-top:10px;">🔄 إعادة تعيين كل التعديلات</button>
                </div>',
                'content_classes' => 'momentum-mods-info',
            ]
        );

        $this->end_controls_section();

        // ============================================
        // TAB: SPACING
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
            'container_bg_color',
            [
                'label'     => esc_html__( 'لون الخلفية', 'momentum-pro-editor' ),
                'type'      => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '{{WRAPPER}} .momentum-html-output' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->end_controls_section();

        // ============================================
        // TAB: CUSTOM CSS
        // ============================================
        $this->start_controls_section(
            'section_custom_css',
            [
                'label' => esc_html__( '🎨 CSS إضافي', 'momentum-pro-editor' ),
                'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'custom_css',
            [
                'label'    => esc_html__( 'كود CSS', 'momentum-pro-editor' ),
                'type'     => \Elementor\Controls_Manager::CODE,
                'language' => 'css',
                'rows'     => 10,
                'default'  => '',
            ]
        );

        $this->end_controls_section();
    }

    protected function render() {
        $settings   = $this->get_settings_for_display();
        $html_code  = $settings['html_code'] ?? '';
        $custom_css = $settings['custom_css'] ?? '';
        $saved_mods = $settings['saved_modifications'] ?? '{}';

        if ( empty( $html_code ) ) {
            if ( \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
                echo '<div class="momentum-html-output" style="padding:40px;text-align:center;background:#f9f9f9;border:2px dashed #ddd;border-radius:8px;">';
                echo '<p style="color:#999;font-size:16px;">📝 حط كود HTML في التاب الأولى عشان يظهر هنا</p>';
                echo '</div>';
            }
            return;
        }

        // Apply saved modifications
        $modifications = json_decode( $saved_mods, true );
        if ( ! empty( $modifications ) && is_array( $modifications ) ) {
            $html_code = $this->apply_modifications( $html_code, $modifications );
        }

        $widget_id = $this->get_id();
        $is_editor = \Elementor\Plugin::$instance->editor->is_edit_mode();

        echo '<div class="momentum-html-output' . ( $is_editor ? ' momentum-editable' : '' ) . '" data-widget-id="' . esc_attr( $widget_id ) . '">';

        if ( ! empty( $custom_css ) ) {
            echo '<style>' . $custom_css . '</style>';
        }

        echo $html_code;
        echo '</div>';
    }

    private function apply_modifications( $html_code, $modifications ) {
        if ( empty( $modifications ) ) {
            return $html_code;
        }

        $dom = new \DOMDocument();
        libxml_use_internal_errors( true );

        $html_wrapped = '<?xml encoding="UTF-8"><div id="m-root">' . $html_code . '</div>';
        $dom->loadHTML( $html_wrapped, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEDEFAULT );
        libxml_clear_errors();

        $xpath = new \DOMXPath( $dom );

        // Apply text modifications
        if ( isset( $modifications['texts'] ) && is_array( $modifications['texts'] ) ) {
            foreach ( $modifications['texts'] as $selector => $data ) {
                $parts = explode( ':', $selector );
                if ( count( $parts ) !== 2 ) continue;

                $tag   = sanitize_key( $parts[0] );
                $index = intval( $parts[1] );

                $allowed_tags = [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'td', 'th', 'label', 'button', 'strong', 'em', 'b', 'i', 'small', 'blockquote' ];
                if ( ! in_array( $tag, $allowed_tags ) ) continue;

                $elements = $xpath->query( '//' . $tag );
                $counter  = 0;

                foreach ( $elements as $el ) {
                    if ( $counter === $index ) {
                        // Update text
                        if ( isset( $data['text'] ) ) {
                            $has_children = false;
                            foreach ( $el->childNodes as $child ) {
                                if ( $child->nodeType === XML_ELEMENT_NODE ) {
                                    $has_children = true;
                                    break;
                                }
                            }
                            if ( ! $has_children ) {
                                $el->nodeValue = '';
                                $el->appendChild( $dom->createTextNode( $data['text'] ) );
                            }
                        }

                        // Apply styles
                        $style = $el->getAttribute( 'style' ) ?: '';

                        if ( isset( $data['color'] ) ) {
                            $style = preg_replace( '/color\s*:[^;]+;?/', '', $style );
                            $style .= ';color:' . sanitize_text_field( $data['color'] );
                        }
                        if ( isset( $data['fontSize'] ) ) {
                            $style = preg_replace( '/font-size\s*:[^;]+;?/', '', $style );
                            $style .= ';font-size:' . sanitize_text_field( $data['fontSize'] );
                        }
                        if ( isset( $data['fontWeight'] ) ) {
                            $style = preg_replace( '/font-weight\s*:[^;]+;?/', '', $style );
                            $style .= ';font-weight:' . sanitize_text_field( $data['fontWeight'] );
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

        // Apply image modifications
        if ( isset( $modifications['images'] ) && is_array( $modifications['images'] ) ) {
            $images = $xpath->query( '//img' );
            foreach ( $modifications['images'] as $idx => $data ) {
                $index   = intval( $idx );
                $counter = 0;
                foreach ( $images as $img ) {
                    if ( $counter === $index ) {
                        if ( isset( $data['src'] ) ) {
                            $img->setAttribute( 'src', esc_url( $data['src'] ) );
                        }
                        break;
                    }
                    $counter++;
                }
            }
        }

        $root   = $dom->getElementById( 'm-root' );
        $output = '';
        if ( $root ) {
            foreach ( $root->childNodes as $child ) {
                $output .= $dom->saveHTML( $child );
            }
        }

        return $output ?: $html_code;
    }

    protected function content_template() {
        ?>
        <#
        var htmlCode = settings.html_code || '';
        var customCss = settings.custom_css || '';
        #>
        <div class="momentum-html-output momentum-editable" data-widget-id="{{ view.getID() }}">
            <# if ( customCss ) { #>
                <style>{{{ customCss }}}</style>
            <# } #>
            <# if ( htmlCode ) { #>
                {{{ htmlCode }}}
            <# } else { #>
                <div style="padding:40px;text-align:center;background:#f9f9f9;border:2px dashed #ddd;border-radius:8px;">
                    <p style="color:#999;font-size:16px;">📝 حط كود HTML في التاب الأولى عشان يظهر هنا</p>
                </div>
            <# } #>
        </div>
        <?php
    }
}
