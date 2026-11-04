import React from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';
import {uiColors} from './palette';

export type WindowRect = Readonly<{x: number; y: number; w: number; h: number}>;
export type Bounds = Readonly<{width: number; height: number}>;

export const MIN_SPLIT_RATIO = 0.15;
export const MAX_SPLIT_RATIO = 0.8;
export const MIN_WINDOW_WIDTH = 190;
export const MIN_WINDOW_HEIGHT = 140;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Keeps a window inside the screen and at least minimum size. */
export function fitWindow(rect: WindowRect, bounds: Bounds): WindowRect {
  const w = clamp(rect.w, Math.min(MIN_WINDOW_WIDTH, bounds.width), bounds.width);
  const h = clamp(rect.h, Math.min(MIN_WINDOW_HEIGHT, bounds.height), bounds.height);
  return {w, h, x: clamp(rect.x, 0, bounds.width - w), y: clamp(rect.y, 0, bounds.height - h)};
}

export function nextSplitRatio(start: number, dy: number, height: number): number {
  if (height <= 0) return start;
  return clamp(start + dy / height, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO);
}

type SplitDividerProps = Readonly<{
  ratio: number;
  containerHeight: number;
  onRatioChange: (ratio: number) => void;
}>;

/** The drag line between the browser (top) and terminal (bottom) in split mode. */
export function SplitDivider({ratio, containerHeight, onRatioChange}: SplitDividerProps): React.JSX.Element {
  const latest = React.useRef({ratio, containerHeight, onRatioChange});
  latest.current = {ratio, containerHeight, onRatioChange};
  const startRatio = React.useRef(ratio);
  const responder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      startRatio.current = latest.current.ratio;
    },
    onPanResponderMove: (_event, gesture) => {
      latest.current.onRatioChange(nextSplitRatio(startRatio.current, gesture.dy, latest.current.containerHeight));
    },
  }), []);
  return (
    <View accessibilityLabel="Drag to resize browser and terminal" style={styles.divider} testID="browser-split-divider" {...responder.panHandlers}>
      <View style={styles.dividerPill} />
    </View>
  );
}

type FloatingWindowProps = Readonly<{
  rect: WindowRect;
  bounds: Bounds;
  onRectChange: (rect: WindowRect) => void;
  children: React.ReactNode;
}>;

/** A small browser window: drag the top strip to move it, the corner to resize it. */
export function FloatingWindow({rect, bounds, onRectChange, children}: FloatingWindowProps): React.JSX.Element {
  const fitted = fitWindow(rect, bounds);
  const latest = React.useRef({rect: fitted, bounds, onRectChange});
  latest.current = {rect: fitted, bounds, onRectChange};
  const start = React.useRef<WindowRect>(fitted);

  const mover = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start.current = latest.current.rect;
    },
    onPanResponderMove: (_event, gesture) => {
      const s = start.current;
      latest.current.onRectChange(fitWindow({...s, x: s.x + gesture.dx, y: s.y + gesture.dy}, latest.current.bounds));
    },
  }), []);

  const resizer = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start.current = latest.current.rect;
    },
    onPanResponderMove: (_event, gesture) => {
      const s = start.current;
      const {bounds: b} = latest.current;
      const w = clamp(s.w + gesture.dx, MIN_WINDOW_WIDTH, b.width - s.x);
      const h = clamp(s.h + gesture.dy, MIN_WINDOW_HEIGHT, b.height - s.y);
      latest.current.onRectChange({...s, w, h});
    },
  }), []);

  return (
    <View style={[styles.window, {height: fitted.h, left: fitted.x, top: fitted.y, width: fitted.w}]} testID="browser-window">
      <View accessibilityLabel="Drag to move the browser window" style={styles.titleStrip} testID="browser-window-move" {...mover.panHandlers}>
        <View style={styles.dividerPill} />
      </View>
      <View style={styles.windowBody}>{children}</View>
      <View accessibilityLabel="Drag to resize the browser window" style={styles.resizeHandle} testID="browser-window-resize" {...resizer.panHandlers}>
        <View style={styles.resizeMark} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {alignItems: 'center', backgroundColor: uiColors.panel, height: 24, justifyContent: 'center', zIndex: 5},
  dividerPill: {backgroundColor: uiColors.accent, borderRadius: 3, height: 5, width: 44},
  window: {backgroundColor: uiColors.panel, borderColor: uiColors.accent, borderRadius: 12, borderWidth: 2, elevation: 24, overflow: 'hidden', position: 'absolute', zIndex: 24},
  titleStrip: {alignItems: 'center', backgroundColor: uiColors.panel, height: 22, justifyContent: 'center'},
  windowBody: {flex: 1},
  resizeHandle: {alignItems: 'flex-end', bottom: 0, height: 34, justifyContent: 'flex-end', padding: 4, position: 'absolute', right: 0, width: 34},
  resizeMark: {borderBottomColor: uiColors.accent, borderBottomWidth: 4, borderRightColor: uiColors.accent, borderRightWidth: 4, height: 14, width: 14},
});
