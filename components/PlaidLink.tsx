import { useState } from 'react';
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
  onSuccess: (publicToken: string, metadata: PlaidMetadata) => void;
  onExit: () => void;
}

/**
 * Generates an HTML page that loads Plaid Link via CDN.
 * When the user completes the flow, postMessage sends the result back to React Native.
 */
function buildPlaidHtml(linkToken: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
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
      var handler = Plaid.create({
        token: '${linkToken}',
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
            error: err,
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
</html>
`;
}

export function PlaidLink({ linkToken, onSuccess, onExit }: PlaidLinkProps) {
  const [loading, setLoading] = useState(true);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') {
        onSuccess(data.public_token, data.metadata ?? {});
      } else if (data.type === 'exit') {
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
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
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
