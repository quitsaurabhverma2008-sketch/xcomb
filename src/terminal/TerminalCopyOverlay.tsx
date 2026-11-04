import React from 'react';
import {BackHandler, ScrollView, StyleSheet, Text, View} from 'react-native';
import {InteractivePressable as Pressable} from '../ui/InteractivePressable';
import {UI_FONT_FAMILY} from '../ui/typography';
import {uiColors} from './palette';
import {TERMINAL_BACKGROUND, TERMINAL_FOREGROUND} from './terminalBuffer';

type TerminalCopyOverlayProps = Readonly<{
  /** The terminal's text: its screen and scrollback. */
  text: string;
  onClose: () => void;
  /** Puts the whole text on the clipboard; resolves whether it worked. */
  onCopyAll: (text: string) => Promise<boolean>;
}>;

/**
 * A plain, selectable copy of the terminal's text. The live terminal is drawn
 * natively and its touches drive scrolling and the running app, so selecting
 * there is not possible. Here, long-press a word and drag the handles to pick
 * any part and use Android's Copy, or tap COPY ALL.
 */
export function TerminalCopyOverlay({text, onClose, onCopyAll}: TerminalCopyOverlayProps): React.JSX.Element {
  const [copied, setCopied] = React.useState<'idle' | 'done' | 'failed'>('idle');
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  // Back closes this view first instead of leaving the terminal.
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);
  const copyAll = React.useCallback(() => {
    onCopyAll(text).then(ok => setCopied(ok ? 'done' : 'failed'), () => setCopied('failed'));
  }, [onCopyAll, text]);
  return (
    <View style={styles.root} testID="terminal-copy-overlay">
      <View style={styles.header}>
        <Text style={styles.title}>SELECT & COPY</Text>
        <View style={styles.actions}>
          <Pressable accessibilityLabel="Copy all text" accessibilityRole="button" onPress={copyAll} style={styles.button} testID="terminal-copy-all">
            <Text style={[styles.buttonText, styles.primaryText]}>{copied === 'done' ? 'COPIED' : copied === 'failed' ? 'FAILED' : 'COPY ALL'}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={[styles.button, styles.closeButton]} testID="terminal-copy-close">
            <Text style={styles.buttonText}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>Long-press a word, drag the handles, then tap Copy.</Text>
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({animated: false})}
        ref={scrollRef}
        style={styles.scroll}>
        <Text selectable style={styles.text} testID="terminal-copy-text">{text}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {backgroundColor: TERMINAL_BACKGROUND, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 30},
  header: {alignItems: 'center', borderBottomColor: uiColors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10},
  title: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '800', letterSpacing: 1},
  actions: {flexDirection: 'row', gap: 8},
  button: {backgroundColor: uiColors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8},
  closeButton: {backgroundColor: uiColors.panelRaised, borderColor: uiColors.border, borderWidth: 1},
  primaryText: {color: uiColors.inset},
  buttonText: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 11, fontWeight: '800'},
  hint: {color: uiColors.subdued, fontFamily: UI_FONT_FAMILY, fontSize: 10, paddingHorizontal: 12, paddingTop: 8},
  scroll: {flex: 1},
  content: {padding: 12},
  text: {color: TERMINAL_FOREGROUND, fontFamily: 'monospace', fontSize: 12, lineHeight: 17},
});
