import React from 'react';
import {Keyboard, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent} from 'react-native';
import {NativeBrowserView, type BrowserState} from '../native/NativeBrowserView';
import {InteractivePressable} from '../ui/InteractivePressable';
import {uiColors} from './palette';

export const DEFAULT_BROWSER_URL = 'http://localhost:3000';

/**
 * Turns what was typed in the address bar into a loadable address. A bare
 * port (`3000`, `:8080`) or host (`localhost:5173`) means a dev server on this
 * device; other text without a scheme gets https.
 */
export function normalizeBrowserAddress(input: string): string {
  const text = input.trim();
  if (text.length === 0) return DEFAULT_BROWSER_URL;
  // Any address that already names a scheme is kept as typed (https, about:,
  // data:, view-source:, mailto: ...); native decides what is safe to open.
  if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(text)) return text;
  if (/^:?\d{2,5}(\/.*)?$/.test(text)) return `http://localhost:${text.replace(/^:/, '')}`;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?(\/.*)?$/i.test(text)) {
    return `http://${text.replace(/^0\.0\.0\.0/, 'localhost')}`;
  }
  // Plain words are a search, a name with a dot is a site.
  if (/\s/.test(text) || !text.includes('.')) return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
  return `https://${text}`;
}

const LOCAL_URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{2,5}(?:\/[^\s"'<>)\]]*)?/i;

/** The first dev-server address (localhost / 127.0.0.1 / 0.0.0.0 with a port) in some terminal text. */
export function findLocalUrl(text: string): string | undefined {
  const match = LOCAL_URL_PATTERN.exec(text);
  if (match === null) return undefined;
  return match[0].replace(/^(https?:\/\/)0\.0\.0\.0/i, '$1localhost').replace(/[.,;:]+$/, '');
}

export function isLocalDevUrl(url: string): boolean {
  return findLocalUrl(url) === url || LOCAL_URL_PATTERN.test(url);
}

/** Omni Router's dashboard. */
export const OMNI_ROUTER_URL = 'http://localhost:20128';

type BrowserPaneProps = Readonly<{
  onClose: () => void;
  initialUrl?: string;
  /** Reports the page address so a layout change (split / window) can reopen it. */
  onUrlChange?: (url: string) => void;
  /** Fewer controls, for the small floating window. */
  compact?: boolean;
}>;

/** The browser half of the split screen: address bar, back/reload and a WebView. */
export function BrowserPane({onClose, initialUrl = DEFAULT_BROWSER_URL, onUrlChange, compact = false}: BrowserPaneProps): React.JSX.Element {
  const [address, setAddress] = React.useState(initialUrl);
  const [url, setUrl] = React.useState(initialUrl);
  const [state, setState] = React.useState<BrowserState | undefined>(undefined);
  const [reload, setReload] = React.useState(0);
  const [back, setBack] = React.useState(0);
  const [forward, setForward] = React.useState(0);

  const go = React.useCallback(() => {
    const next = normalizeBrowserAddress(address);
    setAddress(next);
    setUrl(next);
    // Loading the same address again must still refresh the page.
    setReload(value => value + 1);
    Keyboard.dismiss();
  }, [address]);

  const handleState = React.useCallback((event: NativeSyntheticEvent<BrowserState>) => {
    const next = event.nativeEvent;
    setState(next);
    if (next.url.length > 0) {
      setAddress(next.url);
      onUrlChange?.(next.url);
    }
  }, [onUrlChange]);

  return (
    <View style={styles.pane} testID="browser-pane">
      <View style={styles.bar}>
        <InteractivePressable accessibilityLabel="Browser back" disabled={state?.canGoBack !== true} onPress={() => setBack(value => value + 1)} style={[styles.button, state?.canGoBack !== true && styles.disabled]} testID="browser-back">
          <Text style={styles.buttonText}>‹</Text>
        </InteractivePressable>
        {compact ? null : <InteractivePressable accessibilityLabel="Browser forward" disabled={state?.canGoForward !== true} onPress={() => setForward(value => value + 1)} style={[styles.button, state?.canGoForward !== true && styles.disabled]} testID="browser-forward">
          <Text style={styles.buttonText}>›</Text>
        </InteractivePressable>}
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setAddress}
          onSubmitEditing={go}
          returnKeyType="go"
          selectTextOnFocus
          style={styles.input}
          testID="browser-address"
          value={address}
        />
        <InteractivePressable accessibilityLabel="Reload page" onPress={() => setReload(value => value + 1)} style={styles.button} testID="browser-reload">
          <Text style={styles.buttonText}>{state?.loading === true ? '…' : '⟳'}</Text>
        </InteractivePressable>
        <InteractivePressable accessibilityLabel="Close browser" onPress={onClose} style={styles.button} testID="browser-close">
          <Text style={styles.buttonText}>✕</Text>
        </InteractivePressable>
      </View>
      <View style={styles.page}>
        <NativeBrowserView
          backRequest={back}
          forwardRequest={forward}
          onBrowserState={handleState}
          reloadRequest={reload}
          style={styles.web}
          url={url}
        />
        {state?.error !== undefined ? (
          <View pointerEvents="none" style={styles.errorBox}>
            <Text style={styles.errorTitle}>Can't open this page</Text>
            <Text style={styles.errorText}>{state.error}</Text>
            <Text style={styles.errorText}>Is your dev server running? Start it in the terminal, then tap reload.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {backgroundColor: uiColors.inset, borderBottomColor: uiColors.accent, borderBottomWidth: 2, flex: 1},
  bar: {alignItems: 'center', backgroundColor: uiColors.panel, flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingVertical: 6},
  button: {alignItems: 'center', backgroundColor: uiColors.accentSurface, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: 36},
  disabled: {opacity: 0.4},
  buttonText: {color: uiColors.accent, fontSize: 18, fontWeight: '800', includeFontPadding: false, lineHeight: 22},
  input: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: '#FFFFFF', flex: 1, fontSize: 12, height: 34, paddingHorizontal: 10, paddingVertical: 0},
  page: {backgroundColor: '#FFFFFF', flex: 1},
  web: {flex: 1},
  errorBox: {backgroundColor: uiColors.inset, bottom: 0, justifyContent: 'center', left: 0, padding: 16, position: 'absolute', right: 0, top: 0},
  errorTitle: {color: uiColors.accent, fontSize: 14, fontWeight: '800', marginBottom: 6},
  errorText: {color: uiColors.muted, fontSize: 12, marginBottom: 4},
});
