import React from 'react';
import {Dimensions, Image, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {AGENT_CONFIGS, type AgentConfig} from '../files/agentConfigs';
import {HARNESS_LOGO_SOURCES} from '../terminal/harnessLogos';
import {uiColors} from './brand';
import {EntryIcon} from './EntryIcon';
import {InteractivePressable as Pressable} from './InteractivePressable';
import {UI_FONT_FAMILY} from './typography';

const PAGE_TITLES = ['HOME', 'CONNECTORS', 'CONFIG'] as const;

type HomePagerProps = Readonly<{
  home: React.ReactNode;
  connectors: React.ReactNode;
  config: React.ReactNode;
}>;

/** Home, Connectors and Config files side by side: swipe right for the next page. */
export function HomePager({home, connectors, config}: HomePagerProps): React.JSX.Element {
  const scrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const [measuredWidth, setWidth] = React.useState(0);
  // Until the first layout, fall back to the window so pages always render.
  const width = measuredWidth > 0 ? measuredWidth : Dimensions.get('window').width;
  const [index, setIndex] = React.useState(0);
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);
  const handleEnd = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }, [width]);
  const goTo = React.useCallback((next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({x: next * width, animated: true});
  }, [width]);
  const pages = [home, connectors, config];
  return (
    <View onLayout={handleLayout} style={styles.pager} testID="home-pager">
      <View style={styles.tabs}>
        {PAGE_TITLES.map((title, tab) => (
          <Pressable accessibilityRole="tab" accessibilityState={{selected: index === tab}} key={title} onPress={() => goTo(tab)} style={styles.tab} testID={`home-tab-${title.toLowerCase()}`}>
            <Text style={[styles.tabText, index === tab && styles.tabTextActive]}>{title}</Text>
            <View style={[styles.tabBar, index === tab && styles.tabBarActive]} />
          </Pressable>
        ))}
      </View>
      {(
        <ScrollView
          horizontal
          nestedScrollEnabled
          onMomentumScrollEnd={handleEnd}
          pagingEnabled
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          style={styles.pages}>
          {pages.map((page, pageIndex) => (
            <View key={PAGE_TITLES[pageIndex]} style={{width}}>{page}</View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

type ConnectorsPageProps = Readonly<{onOpenOmniRouter: () => void}>;

/** Services that run inside XComb and show their own dashboard in the built-in browser. */
export function ConnectorsPage({onOpenOmniRouter}: ConnectorsPageProps): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.page} testID="connectors-page">
      <Text style={styles.heading}>CONNECTORS</Text>
      <Text style={styles.lead}>Tools that run inside XComb and open their own dashboard in a small window.</Text>
      <Pressable accessibilityLabel="Omni Router, AI gateway" accessibilityRole="button" onPress={onOpenOmniRouter} style={styles.connector} testID="connector-omniroute">
        <Image resizeMode="contain" source={HARNESS_LOGO_SOURCES.omniroute} style={styles.connectorLogo} />
        <View style={styles.connectorCopy}>
          <Text numberOfLines={1} style={styles.connectorTitle}>Omni Router</Text>
          <Text numberOfLines={2} style={styles.connectorDetail}>One local endpoint for many AI providers. Starts the server and opens its dashboard.</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Pressable>
    </ScrollView>
  );
}

type ConfigPageProps = Readonly<{onOpenConfig: (agent: AgentConfig) => void}>;

/** One folder per installed tool, so its settings can be edited without leaving XComb. */
export function ConfigPage({onOpenConfig}: ConfigPageProps): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.page} testID="config-page">
      <Text style={styles.heading}>CONFIG FILES</Text>
      <Text style={styles.lead}>Open a tool's folder, edit its settings and save them right here.</Text>
      {AGENT_CONFIGS.map(agent => (
        <Pressable accessibilityLabel={`${agent.label} settings`} accessibilityRole="button" key={agent.key} onPress={() => onOpenConfig(agent)} style={styles.configRow} testID={`config-open-${agent.key}`}>
          <EntryIcon kind="folder" />
          <Text numberOfLines={1} style={styles.configName}>{agent.label}</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pager: {flex: 1},
  pages: {flex: 1},
  tabs: {flexDirection: 'row', paddingHorizontal: 18},
  tab: {alignItems: 'center', flex: 1, paddingTop: 6},
  tabText: {color: uiColors.subdued, fontFamily: UI_FONT_FAMILY, fontSize: 10, fontWeight: '800', letterSpacing: 0.9},
  tabTextActive: {color: uiColors.accent},
  tabBar: {backgroundColor: 'transparent', borderRadius: 2, height: 3, marginTop: 6, width: '70%'},
  tabBarActive: {backgroundColor: uiColors.accent},
  page: {paddingBottom: 24, paddingHorizontal: 18, paddingTop: 14},
  heading: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '800', letterSpacing: 1},
  lead: {color: uiColors.muted, fontFamily: UI_FONT_FAMILY, fontSize: 11, lineHeight: 17, marginBottom: 14, marginTop: 6},
  connector: {alignItems: 'center', backgroundColor: uiColors.panel, borderColor: uiColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 88, padding: 12},
  connectorLogo: {borderRadius: 10, height: 52, marginRight: 12, width: 52},
  connectorCopy: {flex: 1, minWidth: 0},
  connectorTitle: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 15, fontWeight: '700'},
  connectorDetail: {color: uiColors.subdued, fontFamily: UI_FONT_FAMILY, fontSize: 10, lineHeight: 15, marginTop: 4},
  arrow: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 22, marginLeft: 10},
  configRow: {alignItems: 'center', backgroundColor: uiColors.panel, borderColor: uiColors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', marginBottom: 8, minHeight: 56, paddingHorizontal: 14},
  configName: {color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 14, fontWeight: '700'},
});
