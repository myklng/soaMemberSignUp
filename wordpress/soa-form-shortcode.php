<?php
/**
 * SOA Singapore — Membership Form Shortcode
 * ==========================================
 * Paste into your theme's functions.php OR a site-specific plugin.
 * Usage in pages/posts: [soa_signup_form]
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CONFIGURATION — edit these values when re-pasting                      │
// └─────────────────────────────────────────────────────────────────────────┘

// Raw URL of the form HTML file in your GitHub repository.
define( 'SOA_FORM_GITHUB_RAW_URL',
    'https://raw.githubusercontent.com/myklng/soaMemberSignUp/main/soa-signup-form.html'
);

// Raw URL of the form CSS file (fetched and inlined at render time).
define( 'SOA_CSS_GITHUB_RAW_URL',
    'https://raw.githubusercontent.com/myklng/soaMemberSignUp/main/soa-signup-form.css'
);

// Google Apps Script web-app URL (kept here so it never appears in the public repo).
define( 'SOA_APPS_SCRIPT_URL',
    'https://script.google.com/macros/s/AKfycbx3QcRL9R18OxZFaZbThzqWjNfouVfqVFVnr--6DIxwr0H3fMze8K0ElUxUuXvK_8tU6A/exec'
);

// Cache lifetime in seconds. 0 = always fetch fresh (handy during development).
define( 'SOA_FORM_CACHE_TTL', 300 );

// Secret token for the cache-bust endpoint.
// Must match the value added to wp-config.php:
//   define( 'SOA_CACHE_BUST_SECRET', 'your-random-secret-here' );

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  SHORTCODE                                                               │
// └─────────────────────────────────────────────────────────────────────────┘

add_shortcode( 'soa_signup_form', 'soa_render_signup_form' );

function soa_render_signup_form() {
    $cache_key = 'soa_signup_form_html';

    $cached = get_transient( $cache_key );
    if ( $cached !== false ) {
        return soa_inject_config( $cached );
    }

    $wp_ua = array(
        'timeout'    => 15,
        'user-agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
    );

    // Fetch HTML
    $response = wp_remote_get( SOA_FORM_GITHUB_RAW_URL, $wp_ua );
    if ( is_wp_error( $response ) ) {
        error_log( '[SOA Form] Failed to fetch form HTML from GitHub: ' . $response->get_error_message() );
        return '<p class="soa-load-error" style="color:#dc2626;padding:12px;border:1px solid #fca5a5;border-radius:4px;">'
             . 'The membership application form is temporarily unavailable. Please try again later or '
             . '<a href="mailto:admin@soa.org.sg">contact us</a> directly.'
             . '</p>';
    }
    $http_code = wp_remote_retrieve_response_code( $response );
    if ( $http_code !== 200 ) {
        error_log( '[SOA Form] GitHub returned HTTP ' . $http_code . ' for HTML' );
        return '<p class="soa-load-error">The membership form could not be loaded (HTTP ' . esc_html( $http_code ) . ').</p>';
    }
    $html = wp_remote_retrieve_body( $response );
    if ( strpos( $html, 'soa-form-wrapper' ) === false ) {
        error_log( '[SOA Form] Unexpected response body from GitHub.' );
        return '<p class="soa-load-error">The membership form returned an unexpected response.</p>';
    }

    // Fetch CSS and inline it — do not cache if CSS is unavailable
    $css_response = wp_remote_get( SOA_CSS_GITHUB_RAW_URL, $wp_ua );
    if ( is_wp_error( $css_response ) || wp_remote_retrieve_response_code( $css_response ) !== 200 ) {
        error_log( '[SOA Form] Could not fetch CSS from GitHub — serving without cache.' );
        return soa_inject_config( str_replace( '%%SOA_STYLES%%', '', $html ) );
    }
    $css  = wp_remote_retrieve_body( $css_response );
    if ( empty( trim( $css ) ) ) {
        error_log( '[SOA Form] CSS body was empty — serving without cache.' );
        return soa_inject_config( str_replace( '%%SOA_STYLES%%', '', $html ) );
    }

    $html = str_replace( '%%SOA_STYLES%%', $css, $html );

    if ( SOA_FORM_CACHE_TTL > 0 ) {
        set_transient( $cache_key, $html, SOA_FORM_CACHE_TTL );
    }

    return soa_inject_config( $html );
}

// Replaces placeholders in the fetched HTML with server-side config values.
function soa_inject_config( $html ) {
    return str_replace(
        '%%SOA_APPS_SCRIPT_URL%%',
        esc_url( SOA_APPS_SCRIPT_URL ),
        $html
    );
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  CACHE-BUST REST ENDPOINT                                                │
// │  POST /wp-json/soa/v1/bust-cache                                        │
// │  Header: X-SOA-Secret: <SOA_CACHE_BUST_SECRET from wp-config.php>       │
// │  Called automatically by the GitHub Action on every push to main.       │
// └─────────────────────────────────────────────────────────────────────────┘

add_action( 'rest_api_init', function () {
    register_rest_route( 'soa/v1', '/bust-cache', array(
        'methods'             => 'POST',
        'callback'            => 'soa_bust_form_cache',
        'permission_callback' => '__return_true',
    ) );
} );

function soa_bust_form_cache( WP_REST_Request $request ) {
    $secret = defined( 'SOA_CACHE_BUST_SECRET' ) ? SOA_CACHE_BUST_SECRET : '';
    if ( ! $secret || $request->get_header( 'X-SOA-Secret' ) !== $secret ) {
        return new WP_REST_Response( array( 'error' => 'Unauthorized' ), 401 );
    }
    delete_transient( 'soa_signup_form_html' );
    return new WP_REST_Response( array( 'ok' => true, 'message' => 'Cache cleared.' ), 200 );
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * ALTERNATIVE: iframe embed (use if <script>/<style> tags are stripped)
 * ──────────────────────────────────────────────────────────────────────────
 * Some WordPress security setups or page builders strip inline scripts.
 * In that case, host soa-signup-form.html on GitHub Pages (or another
 * static host) and use this shortcode instead:
 *
 * add_shortcode( 'soa_signup_form_iframe', 'soa_render_signup_form_iframe' );
 * function soa_render_signup_form_iframe() {
 *     $url = 'https://YOUR_GITHUB_USER.github.io/YOUR_REPO/soa-signup-form.html';
 *     return '<iframe src="' . esc_url( $url ) . '" '
 *          . 'style="width:100%;border:none;min-height:2400px;" '
 *          . 'title="SOA Membership Application" loading="lazy"></iframe>';
 * }
 * ──────────────────────────────────────────────────────────────────────────
 */
