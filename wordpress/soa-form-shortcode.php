<?php
/**
 * SOA Singapore — Membership Form Shortcode
 * ==========================================
 * Usage  : Paste this snippet into your theme's functions.php
 *          OR into a site-specific plugin (recommended).
 *
 * Usage in pages/posts:
 *   [soa_signup_form]
 *
 * The shortcode fetches the latest form HTML from the public GitHub repository
 * on every page load. To cache the file and reduce GitHub API calls, uncomment
 * the transient caching block below.
 *
 * TODO: Replace GITHUB_RAW_URL with your actual raw file URL.
 */

// Guard against direct file access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * TODO: Update this URL to point to the raw file in your GitHub repository.
 * Format: https://raw.githubusercontent.com/{user}/{repo}/{branch}/wordpress/soa-signup-form.html
 */
define( 'SOA_FORM_GITHUB_RAW_URL',
    'https://raw.githubusercontent.com/myklng/soaMemberSignUp/main/soa-signup-form.html'
);

/**
 * Cache lifetime in seconds.
 * Set to 0 to always fetch fresh (useful during development).
 * Recommended for production: 300 (5 min) or higher.
 */
define( 'SOA_FORM_CACHE_TTL', 300 );

/**
 * [soa_signup_form] shortcode handler.
 * Fetches the form HTML from GitHub and returns it for embedding.
 */
add_shortcode( 'soa_signup_form', 'soa_render_signup_form' );

function soa_render_signup_form() {
    $cache_key = 'soa_signup_form_html';

    // ── Optional transient cache ────────────────────────────────────────────
    // Uncomment this block to cache the GitHub response and avoid hitting
    // GitHub's rate limits on high-traffic pages.
    //
    $cached = get_transient( $cache_key );
    if ( $cached !== false ) {
        return $cached;
    }
    // ────────────────────────────────────────────────────────────────────────

    $response = wp_remote_get(
        SOA_FORM_GITHUB_RAW_URL,
        array(
            'timeout'    => 15,
            'user-agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
        )
    );

    if ( is_wp_error( $response ) ) {
        // Log the error and show a graceful fallback
        error_log( '[SOA Form] Failed to fetch form from GitHub: ' . $response->get_error_message() );
        return '<p class="soa-load-error" style="color:#dc2626;padding:12px;border:1px solid #fca5a5;border-radius:4px;">'
             . 'The membership application form is temporarily unavailable. Please try again later or '
             . '<a href="mailto:admin@soa.org.sg">contact us</a> directly.'
             . '</p>';
    }

    $http_code = wp_remote_retrieve_response_code( $response );
    if ( $http_code !== 200 ) {
        error_log( '[SOA Form] GitHub returned HTTP ' . $http_code );
        return '<p class="soa-load-error">The membership form could not be loaded (HTTP ' . esc_html( $http_code ) . ').</p>';
    }

    $html = wp_remote_retrieve_body( $response );

    // Basic sanity check — ensure we got actual form markup
    if ( strpos( $html, 'soa-form-wrapper' ) === false ) {
        error_log( '[SOA Form] Unexpected response body from GitHub.' );
        return '<p class="soa-load-error">The membership form returned an unexpected response.</p>';
    }

    // ── Cache the successful response ───────────────────────────────────────
    // Uncomment this block if you enabled caching above.
    //
    if ( SOA_FORM_CACHE_TTL > 0 ) {
        set_transient( $cache_key, $html, SOA_FORM_CACHE_TTL );
    }
    // ────────────────────────────────────────────────────────────────────────

    // Return raw HTML — WordPress will embed it into the page content.
    // Note: If your theme or a security plugin strips <script>/<style> tags
    // from shortcode output, either whitelist them or use the iframe method below.
    return $html;
}

/**
 * ──────────────────────────────────────────────────────────────────────────
 * CACHE-BUST REST ENDPOINT
 * ──────────────────────────────────────────────────────────────────────────
 * POST /wp-json/soa/v1/bust-cache
 * Header: X-SOA-Secret: <value of SOA_CACHE_BUST_SECRET in wp-config.php>
 *
 * Called automatically by the GitHub Action on every push to main.
 * To enable, add this to wp-config.php:
 *   define( 'SOA_CACHE_BUST_SECRET', 'your-random-secret-here' );
 */
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
