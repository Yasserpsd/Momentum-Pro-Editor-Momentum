<?php
/**
 * Momentum HTML Pro Widget
 * Elementor Widget - Visual HTML Editor
 * Version: 7.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Momentum_HTML_Pro_Widget extends \Elementor\Widget_Base {

    public function get_name() {
        return 'momentum-html-pro';
    }

    public function get_title() {
        return 'Momentum Pro Editor';
    }

    public function get_icon() {
        return 'eicon-code';
    }

    public function get_categories() {
        return [ 'momentum-pro' ];
    }

    public function get_keywords() {
        return [ 'html', 'code', 'momentum', 'editor', 'visual', 'custom' ];
    }

    protected function register_controls() {

        $this->start_controls_section(
            'section_html_code',
            [
                'label' => '⚡ HTML Code',
                'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );

        $this->add_control(
            'html_code',
            [
                'label'       => 'HTML Code',
                'type'        => \Elementor\Controls_Manager::CODE,
                'language'    => 'html',
                'rows'        => 20,
                'default'     => '<div style="padding:20px; text-align:center;">
<h2>مرحباً بك في Momentum Pro Editor</h2>
<p>اكتب كود HTML هنا ثم عدّله بصرياً من المعاينة!</p>
</div>',
                'description' => '',
                'render_type' => 'none', // === مهم جداً: منع الـ re-render التلقائي ===
            ]
        );

        $this->add_control(
            'sync_button_html',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="margin-top:10px;">'
                    . '<button id="momentum-sync-btn" onclick="momentumSyncToCode()" style="'
                    . 'width:100%;padding:12px 20px;border:none;border-radius:8px;'
                    . 'background:linear-gradient(135deg,#4CAF50,#45a049);color:#fff;'
                    . 'font-size:14px;font-weight:700;cursor:pointer;'
                    . 'display:flex;align-items:center;justify-content:center;gap:8px;'
                    . 'box-shadow:0 2px 10px rgba(76,175,80,0.3);'
                    . '">'
                    . '🔄 مزامنة التعديلات للكود'
                    . '</button>'
                    . '<div id="momentum-sync-status" style="text-align:center;margin-top:8px;font-size:12px;color:#888;min-height:18px;"></div>'
                    . '<p style="color:#888;font-size:11px;margin-top:8px;text-align:center;">'
                    . 'عدّل المحتوى من المعاينة ثم اضغط مزامنة لحفظ التغييرات في الكود'
                    . '</p>'
                    . '</div>',
                'content_classes' => 'elementor-descriptor',
            ]
        );

        // === زر إعادة تحميل Preview بدون ما يهد التصميم ===
        $this->add_control(
            'refresh_button_html',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="margin-top:5px;">'
                    . '<button onclick="momentumRefreshPreview()" style="'
                    . 'width:100%;padding:8px 16px;border:none;border-radius:8px;'
                    . 'background:linear-gradient(135deg,#6C63FF,#5a52e0);color:#fff;'
                    . 'font-size:12px;font-weight:600;cursor:pointer;'
                    . 'display:flex;align-items:center;justify-content:center;gap:6px;'
                    . 'box-shadow:0 2px 8px rgba(108,99,255,0.3);'
                    . '">'
                    . '🔃 تحديث المعاينة'
                    . '</button>'
                    . '</div>'
                    . '<script>'
                    . 'function momentumRefreshPreview(){'
                    . '  try{'
                    . '    var f=elementor.$preview&&elementor.$preview[0];'
                    . '    if(f&&f.contentWindow)f.contentWindow.location.reload();'
                    . '  }catch(e){console.warn("[Momentum] Refresh error:",e);}'
                    . '}'
                    . '</script>',
                'content_classes' => 'elementor-descriptor',
            ]
        );

        $this->end_controls_section();

        $this->start_controls_section(
            'section_spacing',
            [
                'label' => '📐 Spacing & Layout',
                'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'container_padding',
            [
                'label'      => 'Padding',
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', 'em', '%' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'container_margin',
            [
                'label'      => 'Margin',
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', 'em', '%' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'margin: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->add_control(
            'container_bg_color',
            [
                'label'     => 'Background Color',
                'type'      => \Elementor\Controls_Manager::COLOR,
                'selectors' => [
                    '{{WRAPPER}} .momentum-html-output' => 'background-color: {{VALUE}};',
                ],
            ]
        );

        $this->add_control(
            'container_border_radius',
            [
                'label'      => 'Border Radius',
                'type'       => \Elementor\Controls_Manager::DIMENSIONS,
                'size_units' => [ 'px', '%' ],
                'selectors'  => [
                    '{{WRAPPER}} .momentum-html-output' => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
                ],
            ]
        );

        $this->end_controls_section();

        $this->start_controls_section(
            'section_css',
            [
                'label' => '🎨 Custom CSS',
                'tab'   => \Elementor\Controls_Manager::TAB_STYLE,
            ]
        );

        $this->add_control(
            'custom_css',
            [
                'label'       => 'Custom CSS',
                'type'        => \Elementor\Controls_Manager::CODE,
                'language'    => 'css',
                'rows'        => 10,
                'default'     => '',
                'description' => 'أضف CSS مخصص هنا - سيتم تطبيقه على هذا الويدجت فقط.',
            ]
        );

        $this->end_controls_section();
    }

    protected function render() {
        $settings  = $this->get_settings_for_display();
        $html_code = $settings['html_code'] ?? '';
        $css_code  = $settings['custom_css'] ?? '';
        $widget_id = $this->get_id();

        $is_editor = \Elementor\Plugin::$instance->editor->is_edit_mode() ||
                     ( isset( $_GET['elementor-preview'] ) );

        $classes = 'momentum-html-output';
        if ( $is_editor ) {
            $classes .= ' momentum-editable';
        }

        echo '<div class="' . esc_attr( $classes ) . '" data-widget-id="' . esc_attr( $widget_id ) . '">';

        if ( ! empty( $html_code ) ) {
            echo $html_code;
        } else {
            if ( $is_editor ) {
                echo '<div style="padding:40px;text-align:center;color:#999;font-family:sans-serif;">';
                echo '<div style="font-size:40px;margin-bottom:10px;">⚡</div>';
                echo '<p style="font-size:16px;font-weight:600;">Momentum Pro Editor</p>';
                echo '<p style="font-size:13px;">أضف كود HTML في تاب المحتوى</p>';
                echo '</div>';
            }
        }

        echo '</div>';

        if ( ! empty( $css_code ) ) {
            echo '<style class="momentum-custom-css">';
            echo wp_strip_all_tags( $css_code );
            echo '</style>';
        }
    }

    protected function content_template() {
        ?>
        <#
        var htmlCode = settings.html_code || '';
        var cssCode  = settings.custom_css || '';
        var widgetId = view.getID ? view.getID() : '';
        var classes = 'momentum-html-output momentum-editable';
        #>
        <div class="{{{ classes }}}" data-widget-id="{{{ widgetId }}}">
            <# if ( htmlCode ) { #>
                {{{ htmlCode }}}
            <# } else { #>
                <div style="padding:40px;text-align:center;color:#999;font-family:sans-serif;">
                    <div style="font-size:40px;margin-bottom:10px;">⚡</div>
                    <p style="font-size:16px;font-weight:600;">Momentum Pro Editor</p>
                    <p style="font-size:13px;">أضف كود HTML في تاب المحتوى</p>
                </div>
            <# } #>
        </div>
        <# if ( cssCode ) { #>
            <style class="momentum-custom-css">{{{ cssCode }}}</style>
        <# } #>
        <?php
    }
}
