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
                'label'    => esc_html__( 'الكود', 'momentum-pro-editor' ),
                'type'     => \Elementor\Controls_Manager::CODE,
                'language' => 'html',
                'rows'     => 20,
                'default'  => '<div style="padding:40px; text-align:center;">
    <h1 style="color:#333; font-size:36px; margin-bottom:15px;">مرحباً بيك في Momentum Pro Editor</h1>
    <p style="color:#666; font-size:18px; margin-bottom:25px;">حدد أي كلمة وغيّر لونها أو نسّقها كما تشاء</p>
    <a href="https://example.com" style="background:#6C63FF; color:#fff; padding:12px 30px; border-radius:8px; text-decoration:none; font-size:16px; display:inline-block;">اضغط هنا</a>
    <img src="https://via.placeholder.com/600x300/6C63FF/ffffff?text=Momentum+Pro" alt="صورة تجريبية" width="600" height="300" style="margin-top:25px; border-radius:12px; display:block; margin-left:auto; margin-right:auto;">
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
                    <p style="color:#888;font-size:11px;text-align:center;margin-top:6px;">بيحدّث كود HTML بكل التغييرات اللي عملتها</p>
                </div>',
            ]
        );

        $this->add_control(
            'usage_guide',
            [
                'type' => \Elementor\Controls_Manager::RAW_HTML,
                'raw'  => '<div style="background:linear-gradient(135deg,#6C63FF,#4CAF50);color:#fff;padding:16px;border-radius:10px;margin-top:10px;line-height:1.8;">
                    <strong style="font-size:14px;">💡 طريقة الاستخدام:</strong><br>
                    ✏️ اضغط على أي <strong>نص</strong> عشان تعدله<br>
                    🎯 <strong>حدد جزء من النص</strong> وغيّر لونه أو نسّقه<br>
                    🎨 استخدم <strong>الـ Toolbar</strong> لتغيير الألوان والخطوط<br>
                    📷 اضغط على أي <strong>صورة</strong> عشان تغيرها<br>
                    🔗 اضغط مرتين على أي <strong>رابط</strong> عشان تعدله<br>
                    🖱️ كليك يمين على أي <strong>Box</strong> لأدوات متقدمة<br>
                    ↩️ <strong>Ctrl+Z</strong> للتراجع<br>
                    🔄 اضغط <strong>مزامنة</strong> عشان التعديلات تنعكس على الكود
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

        $editor_class = $is_editor ? ' momentum-editable' : '';

        echo '<div class="momentum-html-output' . $editor_class . '" data-widget-id="' . esc_attr( $widget_id ) . '">';

        if ( ! empty( $custom_css ) ) {
            echo '<style>' . wp_strip_all_tags( $custom_css ) . '</style>';
        }

        echo $html_code;
        echo '</div>';
    }
}
