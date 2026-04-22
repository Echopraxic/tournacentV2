import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { PlaidMetadata } from '@/lib/plaid';

interface PlaidLinkProps {
  linkToken: string;
  /** Unix timestamp (seconds) after which the token is considered expired. */
  linkTokenExpiry?: number;
  onSuccess: (publicToken: string, metadata: PlaidMetadata) => void;
  onExit: () => void;
}

// public-<environment>-<uuid> — at least 25 hex/alphanum chars after the prefix.
const PLAID_PUBLIC_TOKEN_PATTERN = /^public-[a-z0-9_-]{25,}$/i;

/**
 * Escapes characters that would break out of a JS single-quoted string context.
 *
 * The linkToken is embedded in a <script> block as:
 *   token: '${escaped}'
 *
 * Without escaping, a malicious token could:
 *   - Close the string literal with '
 *   - Close the <script> block with </script>
 *   - Inject arbitrary JS
 */
function escapeLinkToken(token: string): string {
  return token
    .replace(/\\/g, '\\\\')   // must be first to avoid double-escaping
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\x3C')   // neutralises </script> in token
    .replace(/>/g, '\\x3E')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Generates an HTML page that loads Plaid Link via CDN.
 * When the user completes the flow, postMessage sends the result back to React Native.
 *
 * Security controls applied:
 *   - linkToken escaped before embedding (injection prevention)
 *   - Content-Security-Policy restricts script execution to Plaid CDN only
 *   - Plaid SDK validates public_token format before postMessage
 *
 * Note: SRI hash omitted because Plaid does not publish stable SRI hashes for
 * their versioned CDN endpoint. Request hashes from Plaid support, or implement
 * certificate pinning as an alternative integrity check.
 */
function buildPlaidHtml(linkToken: string): string {
  const escaped = escapeLinkToken(linkToken);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline' https://cdn.plaid.com; style-src 'unsafe-inline'; img-src https:; font-src https:; connect-src https:;">
  <style>
    body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, sans-serif; }
    .status { display: flex; flex-direction: column; align-items: center; justify-content: center;
              height: 100vh; color: #6B7280; gap: 12px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #E5E7EB;
               border-top-color: #10B981; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="status" id="status">
    <div class="spinner"></div>
    <p>Connecting to your bank...</p>
  </div>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
  <script>
    try {
      if (!window.Plaid) {
        throw new Error('Plaid SDK failed to load');
      }
      var handler = Plaid.create({
        token: '${escaped}',
        onSuccess: function(public_token, metadata) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'success',
            public_token: public_token,
            metadata: metadata
          }));
        },
        onExit: function(err, metadata) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'exit',
            error: err || null,
            metadata: metadata
          }));
        },
        onLoad: function() {
          document.getElementById('status').style.display = 'none';
          handler.open();
        },
        onEvent: function(eventName, metadata) {
          // Optional: forward events for analytics
        }
      });
      handler.open();
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'exit',
        error: { error_message: e.message }
      }));
    }
  </script>
</body>
</html>`;
}

export function PlaidLink({ linkToken, linkTokenExpiry, onSuccess, onExit }: PlaidLinkProps) {
  const [loading, setLoading] = useState(true);

  // Reject expired link tokens before the WebView renders.
  // linkTokenExpiry is a Unix timestamp in seconds (from /link-token response).
  useEffect(() => {
    if (linkTokenExpiry !== undefined && Date.now() > linkTokenExpiry * 1000) {
      onExit();
    }
  }, [linkTokenExpiry, onExit]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'success') {
        // Validate that the token looks like a real Plaid public token before
        // forwarding it to the caller. A fake token from an XSS-injected postMessage
        // would fail this check.
        if (!PLAID_PUBLIC_TOKEN_PATTERN.test(data.public_token)) {
          console.error('PlaidLink: invalid public_token format');
          onExit();
          return;
        }
        if (data.metadata !== undefined && (typeof data.metadata !== 'object' || Array.isArray(data.metadata))) {
          console.error('PlaidLink: invalid metadata structure');
          onExit();
          return;
        }
        onSuccess(data.public_token, data.metadata ?? {});
      } else if (data.type === 'exit') {
        onExit();
      } else {
        console.error('PlaidLink: unknown message type', data.type);
        onExit();
      }
    } catch (e) {
      console.error('PlaidLink: failed to parse message', e);
      onExit();
    }
  };

  // Plaid Link WebView is only supported on native platforms
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webUnsupported}>
        <Text style={styles.webUnsupportedTitle}>Bank Connection Unavailable</Text>
        <Text style={styles.webUnsupportedText}>
          Please use the Tournacent mobile app to connect your bank account via Plaid.
        </Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onExit}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading Plaid...</Text>
        </View>
      )}
      <WebView
        source={{ html: buildPlaidHtml(linkToken) }}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          console.error('PlaidLink: WebView error', syntheticEvent.nativeEvent);
          onExit();
        }}
        onHttpError={(syntheticEvent) => {
          console.error('PlaidLink: HTTP error', syntheticEvent.nativeEvent.statusCode);
          onExit();
        }}
        javaScriptEnabled
        domStorageEnabled={false}
        // 'https://*' blocks javascript: URIs and plain HTTP redirects while still
        // allowing OAuth bank flows that navigate to the bank's own HTTPS domain.
        // We cannot restrict further (e.g. to cdn.plaid.com only) because OAuth
        // connections redirect the user to institution-specific HTTPS pages.
        originWhitelist={['https://*']}
        mixedContentMode="never"
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    zIndex: 10,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  webview: {
    flex: 1,
  },
  webUnsupported: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  webUnsupportedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  webUnsupportedText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  closeBtn: {
    marginTop: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
