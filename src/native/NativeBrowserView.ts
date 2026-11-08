import {requireNativeComponent, type NativeSyntheticEvent, type ViewProps} from 'react-native';

export type BrowserState = Readonly<{
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  error?: string;
}>;

export type NativeBrowserViewProps = ViewProps & Readonly<{
  url?: string;
  /** Changing any of these counters triggers the action once. */
  reloadRequest: number;
  backRequest: number;
  forwardRequest: number;
  onBrowserState?: (event: NativeSyntheticEvent<BrowserState>) => void;
}>;

/** Android WebView for previewing dev servers beside the terminal. */
export const NativeBrowserView = requireNativeComponent<NativeBrowserViewProps>('XCombBrowserView');
