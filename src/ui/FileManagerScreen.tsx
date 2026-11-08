import React from 'react';
import {AppState, Modal, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {
  baseName,
  errorMessage,
  fm,
  formatBytes,
  formatDate,
  isArchive,
  parentPath,
  type FmEntry,
  type FmInfo,
  type FmRoot,
} from '../files/fileManager';
import {ScreenShell} from '../screen/ScreenShell';
import {BrandBackButton, BrandHeader, uiColors} from './brand';
import {EntryIcon} from './EntryIcon';
import {InteractivePressable as Pressable} from './InteractivePressable';
import {UI_FONT_FAMILY} from './typography';
import {useHardwareBack} from './useHardwareBack';

type SortKey = 'name' | 'date' | 'size';
type Prompt = Readonly<{title: string; initial: string; action: string; onSubmit: (value: string) => void}>;
type Clipboard = Readonly<{paths: readonly string[]; move: boolean}>;

export type FileManagerScreenProps = Readonly<{
  onBack: () => void;
  /** Open this root first (for example `agent:opencode`). */
  initialRootId?: string;
  /** Folders below that root to try first, most likely first. */
  startCandidates?: readonly (readonly string[])[];
  /** Show only the initial root, so the person cannot browse above it. */
  lockRoot?: boolean;
  title?: string;
}>;

const FAVORITES = '__favorites__';

function sortEntries(entries: readonly FmEntry[], key: SortKey): FmEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    if (key === 'date') return b.modifiedMs - a.modifiedMs;
    if (key === 'size') return b.sizeBytes - a.sizeBytes;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/** Full file manager over phone storage, the Linux home, the workspace and each agent's folder. */
export function FileManagerScreen({onBack, initialRootId, startCandidates, lockRoot = false, title = 'Files'}: FileManagerScreenProps): React.JSX.Element {
  const [roots, setRoots] = React.useState<readonly FmRoot[]>([]);
  const [rootId, setRootId] = React.useState<string | undefined>(initialRootId);
  const [dir, setDir] = React.useState<string | undefined>();
  const [entries, setEntries] = React.useState<readonly FmEntry[]>([]);
  const [favorites, setFavorites] = React.useState<readonly string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notice, setNotice] = React.useState<string | undefined>();
  const [sort, setSort] = React.useState<SortKey>('name');
  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [sheet, setSheet] = React.useState<FmEntry | undefined>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState<Prompt | undefined>();
  const [promptValue, setPromptValue] = React.useState('');
  const [infoData, setInfoData] = React.useState<FmInfo | undefined>();
  const [clipboard, setClipboard] = React.useState<Clipboard | undefined>();
  const [access, setAccess] = React.useState(true);
  const [file, setFile] = React.useState<Readonly<{path: string; original: string}> | undefined>();
  const [text, setText] = React.useState('');
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const root = roots.find(r => r.id === rootId);
  const inFavorites = rootId === FAVORITES;
  const dirty = file !== undefined && text !== file.original;
  const visibleRoots = lockRoot ? roots.filter(r => r.id === initialRootId) : roots.filter(r => !r.id.startsWith('agent:'));

  const refreshAccess = React.useCallback(async () => {
    const result = await fm.storageAccess();
    if (mounted.current && result.ok) setAccess(result.value);
  }, []);

  // Roots, favourites and the first folder.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const rootsResult = await fm.roots();
      if (cancelled) return;
      if (!rootsResult.ok) {
        setNotice(errorMessage(rootsResult.code));
        setLoading(false);
        return;
      }
      setRoots(rootsResult.value);
      const first = rootsResult.value.find(r => r.id === (initialRootId ?? 'storage')) ?? rootsResult.value[0];
      if (first === undefined) return;
      setRootId(first.id);
      let start = first.path;
      for (const candidate of startCandidates ?? []) {
        const path = `${first.path}/${candidate.join('/')}`;
        const probe = await fm.list(path);
        if (cancelled) return;
        if (probe.ok) {
          start = path;
          break;
        }
      }
      setDir(start);
      const favs = await fm.favorites();
      if (!cancelled && favs.ok) setFavorites(favs.value);
    })().catch(() => undefined);
    void refreshAccess();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshAccess();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [initialRootId, refreshAccess, startCandidates]);

  const load = React.useCallback(async (path: string) => {
    setLoading(true);
    const result = await fm.list(path);
    if (!mounted.current) return;
    if (result.ok) {
      setEntries(result.value.entries);
      setNotice(undefined);
    } else {
      setEntries([]);
      setNotice(errorMessage(result.code));
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (dir !== undefined && !inFavorites && !searching) void load(dir);
  }, [dir, inFavorites, load, searching]);

  const reload = React.useCallback(() => {
    if (dir !== undefined && !inFavorites) void load(dir);
  }, [dir, inFavorites, load]);

  // Search runs below the current folder.
  React.useEffect(() => {
    if (!searching || dir === undefined || query.trim().length === 0) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      void fm.search(dir, query).then(result => {
        if (cancelled || !mounted.current) return;
        if (result.ok) setEntries(result.value);
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dir, query, searching]);

  const shown = React.useMemo(() => {
    if (inFavorites) {
      return favorites.map<FmEntry>(path => ({name: baseName(path), path, isDirectory: !baseName(path).includes('.'), isSymlink: false, sizeBytes: 0, modifiedMs: 0, canWrite: true}));
    }
    return sortEntries(entries, sort);
  }, [entries, favorites, inFavorites, sort]);

  const report = React.useCallback((result: Readonly<{ok: boolean}> & {code?: string}, done: string) => {
    if (!mounted.current) return;
    setNotice(result.ok ? done : errorMessage(result.code ?? 'failed'));
    if (result.ok) reload();
  }, [reload]);

  const goUp = React.useCallback((): boolean => {
    if (file !== undefined) {
      setFile(undefined);
      return true;
    }
    if (prompt !== undefined || sheet !== undefined || infoData !== undefined || createOpen) {
      setPrompt(undefined);
      setSheet(undefined);
      setInfoData(undefined);
      setCreateOpen(false);
      return true;
    }
    if (selected.length > 0) {
      setSelected([]);
      return true;
    }
    if (searching) {
      setSearching(false);
      setQuery('');
      return true;
    }
    if (dir !== undefined && root !== undefined && dir !== root.path && !inFavorites) {
      setDir(parentPath(dir));
      return true;
    }
    onBack();
    return true;
  }, [createOpen, dir, file, infoData, inFavorites, onBack, prompt, root, searching, selected.length, sheet]);
  useHardwareBack(true, goUp);

  const openEntry = React.useCallback(async (entry: FmEntry) => {
    if (selected.length > 0) {
      setSelected(current => (current.includes(entry.path) ? current.filter(p => p !== entry.path) : [...current, entry.path]));
      return;
    }
    if (entry.isDirectory) {
      setSearching(false);
      setQuery('');
      if (inFavorites) {
        const owner = roots.find(r => entry.path === r.path || entry.path.startsWith(`${r.path}/`));
        if (owner !== undefined) setRootId(owner.id);
      }
      setDir(entry.path);
      return;
    }
    if (isArchive(entry.name)) {
      setSheet(entry);
      return;
    }
    const result = await fm.readText(entry.path);
    if (!mounted.current) return;
    if (result.ok) {
      setFile({path: entry.path, original: result.value});
      setText(result.value);
    } else if (result.code === 'binary_or_invalid_text') {
      setSheet(entry);
    } else {
      setNotice(errorMessage(result.code));
    }
  }, [inFavorites, roots, selected.length]);

  const selectRoot = (id: string) => {
    setSelected([]);
    setSearching(false);
    setQuery('');
    setRootId(id);
    if (id !== FAVORITES) {
      const next = roots.find(r => r.id === id);
      if (next !== undefined) setDir(next.path);
    }
  };

  const ask = (next: Prompt) => {
    setPromptValue(next.initial);
    setPrompt(next);
  };

  const targets = (entry?: FmEntry): string[] => (selected.length > 0 ? [...selected] : entry !== undefined ? [entry.path] : []);

  const doDelete = (paths: string[]) => {
    ask({title: `Delete ${paths.length} item${paths.length === 1 ? '' : 's'}?`, initial: '', action: 'DELETE', onSubmit: () => {
      void fm.remove(paths).then(result => { setSelected([]); report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'Deleted'); });
    }});
  };

  const doCompress = (paths: string[]) => {
    if (dir === undefined) return;
    const suggested = paths.length === 1 ? baseName(paths[0] ?? 'archive') : 'archive';
    ask({title: 'Compress to zip', initial: suggested, action: 'COMPRESS', onSubmit: name => {
      void fm.compress(paths, dir, name).then(result => { setSelected([]); report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'Zip created'); });
    }});
  };

  const doPaste = () => {
    if (clipboard === undefined || dir === undefined) return;
    void fm.paste(clipboard.paths, dir, clipboard.move).then(result => {
      if (result.ok && clipboard.move) setClipboard(undefined);
      report(result.ok ? {ok: true} : {ok: false, code: result.code}, clipboard.move ? 'Moved' : 'Copied');
    });
  };

  const doImport = () => {
    if (dir === undefined) return;
    void fm.importFiles(dir).then(result => {
      if (result.ok) {
        setNotice(result.value === 0 ? 'Nothing imported' : `Imported ${result.value} file${result.value === 1 ? '' : 's'}`);
        reload();
      } else {
        setNotice(errorMessage(result.code));
      }
    });
  };

  const toggleFavorite = (entry: FmEntry) => {
    const on = !favorites.includes(entry.path);
    void fm.setFavorite(entry.path, on).then(async result => {
      if (!result.ok) return;
      const favs = await fm.favorites();
      if (mounted.current && favs.ok) setFavorites(favs.value);
      setNotice(on ? 'Added to favorites' : 'Removed from favorites');
    });
  };

  const sheetAction = (entry: FmEntry, action: string) => {
    setSheet(undefined);
    const paths = targets(entry);
    switch (action) {
      case 'archive':
        void fm.extract(entry.path).then(result => report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'Extracted next to the archive'));
        break;
      case 'compress': doCompress(paths); break;
      case 'info':
        void fm.info(entry.path).then(result => {
          if (result.ok) setInfoData(result.value); else setNotice(errorMessage(result.code));
        });
        break;
      case 'copy': setClipboard({paths, move: false}); setSelected([]); setNotice('Copied. Open a folder and tap PASTE.'); break;
      case 'cut': setClipboard({paths, move: true}); setSelected([]); setNotice('Cut. Open a folder and tap PASTE.'); break;
      case 'delete': doDelete(paths); break;
      case 'rename':
        ask({title: 'Rename', initial: entry.name, action: 'RENAME', onSubmit: name => {
          void fm.rename(entry.path, name).then(result => report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'Renamed'));
        }});
        break;
      case 'share':
        void fm.share(entry.path).then(result => { if (!result.ok) setNotice(errorMessage(result.code)); });
        break;
      case 'favorite': toggleFavorite(entry); break;
      default: break;
    }
  };

  const saveFile = async () => {
    if (file === undefined) return;
    const result = await fm.writeText(file.path, text);
    if (!mounted.current) return;
    if (result.ok) {
      setFile({path: file.path, original: text});
      setNotice('Saved');
    } else {
      setNotice(errorMessage(result.code));
    }
  };

  const createActions: readonly (readonly [string, () => void])[] = [
    ['New folder', () => ask({title: 'New folder', initial: '', action: 'CREATE', onSubmit: name => {
      if (dir !== undefined) void fm.mkdir(dir, name).then(result => report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'Folder created'));
    }})],
    ['New file', () => ask({title: 'New file', initial: '', action: 'CREATE', onSubmit: name => {
      if (dir !== undefined) void fm.createFile(dir, name).then(result => report(result.ok ? {ok: true} : {ok: false, code: result.code}, 'File created'));
    }})],
    ['New archive', () => {
      const paths = selected.length > 0 ? [...selected] : [];
      if (paths.length === 0) setNotice('Select files first (long-press), then New archive.'); else doCompress(paths);
    }],
    ['Import from phone', doImport],
  ];

  const sheetRows = (entry: FmEntry): readonly (readonly [string, string])[] => [
    ...(isArchive(entry.name) ? [['archive', 'Open as archive']] as const : []),
    ['compress', 'Compress (zip)'],
    ['info', 'Information'],
    ['copy', 'Copy'],
    ['cut', 'Cut'],
    ['delete', 'Delete'],
    ['rename', 'Rename'],
    ...(entry.isDirectory ? [] : [['share', 'Share']] as const),
    ['favorite', favorites.includes(entry.path) ? 'Remove from favorites' : 'Add to favorites'],
  ];

  const where = dir === undefined ? '' : root !== undefined && dir.startsWith(root.path) ? `${root.label}${dir.slice(root.path.length)}` : dir;
  const needsAccess = !access && (root?.id === 'storage' || inFavorites);

  if (file !== undefined) {
    return (
      <ScreenShell testID="file-manager-screen">
        <BrandHeader eyebrow="EDIT" title={baseName(file.path)} meta={null} action={<BrandBackButton onPress={() => { goUp(); }} testID="fm-editor-back" />} />
        <View style={styles.editor}>
          <View style={styles.editorBar}>
            <Text numberOfLines={1} style={styles.editorName}>{file.path}{dirty ? ' •' : ''}</Text>
            <Pressable accessibilityRole="button" disabled={!dirty} onPress={() => { void saveFile(); }} style={[styles.primary, !dirty && styles.disabled]} testID="fm-save">
              <Text style={styles.primaryText}>SAVE</Text>
            </Pressable>
          </View>
          {notice !== undefined ? <Text style={styles.notice}>{notice}</Text> : null}
          <TextInput autoCapitalize="none" autoCorrect={false} multiline onChangeText={setText} spellCheck={false} style={styles.editorInput} testID="fm-editor-input" textAlignVertical="top" value={text} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell testID="file-manager-screen">
      <BrandHeader eyebrow="FILES" title={title} meta={null} action={<BrandBackButton onPress={() => { goUp(); }} testID="fm-back" />} />
      <View style={styles.chips}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {visibleRoots.map(r => (
            <Pressable accessibilityRole="button" key={r.id} onPress={() => selectRoot(r.id)} style={[styles.chip, rootId === r.id && styles.chipOn]} testID={`fm-root-${r.id}`}>
              <Text style={[styles.chipText, rootId === r.id && styles.chipTextOn]}>{r.label.toUpperCase()}</Text>
            </Pressable>
          ))}
          {lockRoot ? null : (
            <Pressable accessibilityRole="button" onPress={() => selectRoot(FAVORITES)} style={[styles.chip, inFavorites && styles.chipOn]} testID="fm-root-favorites">
              <Text style={[styles.chipText, inFavorites && styles.chipTextOn]}>★ FAVORITES</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
      <View style={styles.toolbar}>
        {searching ? (
          <TextInput autoCapitalize="none" autoCorrect={false} autoFocus onChangeText={value => { setQuery(value); if (value.trim().length === 0 && dir !== undefined) void load(dir); }} placeholder="Search in this folder" placeholderTextColor={uiColors.subdued} style={styles.search} testID="fm-search-input" value={query} />
        ) : (
          <Text numberOfLines={1} style={styles.where}>{inFavorites ? 'Favorites' : where}</Text>
        )}
        <Pressable accessibilityLabel="Search" accessibilityRole="button" onPress={() => { setSearching(s => !s); setQuery(''); }} style={styles.tool} testID="fm-search"><Text style={styles.toolText}>⌕</Text></Pressable>
        <Pressable accessibilityLabel="Sort" accessibilityRole="button" onPress={() => setSort(s => (s === 'name' ? 'date' : s === 'date' ? 'size' : 'name'))} style={styles.tool} testID="fm-sort"><Text style={styles.toolTextSmall}>{sort.toUpperCase()}</Text></Pressable>
        {inFavorites ? null : <Pressable accessibilityLabel="Create" accessibilityRole="button" onPress={() => setCreateOpen(true)} style={styles.toolAccent} testID="fm-create"><Text style={styles.toolAccentText}>+</Text></Pressable>}
      </View>
      {needsAccess ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Allow “All files access” so XComb and your AI agents can use phone storage.</Text>
          <Pressable accessibilityRole="button" onPress={() => { void fm.requestStorageAccess().then(refreshAccess); }} style={styles.primary} testID="fm-grant"><Text style={styles.primaryText}>GRANT</Text></Pressable>
        </View>
      ) : null}
      {notice !== undefined ? <Text style={styles.notice} testID="fm-notice">{notice}</Text> : null}
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {dir !== undefined && root !== undefined && dir !== root.path && !inFavorites && !searching ? (
          <Pressable accessibilityRole="button" onPress={() => setDir(parentPath(dir))} style={styles.row} testID="fm-up">
            <Text style={styles.up}>↑</Text>
            <Text style={styles.name}>Up one folder</Text>
          </Pressable>
        ) : null}
        {loading ? <Text style={styles.note}>Loading…</Text> : null}
        {!loading && shown.length === 0 ? <Text style={styles.note}>{inFavorites ? 'No favorites yet. Use ⋮ on a file or folder.' : 'This folder is empty.'}</Text> : null}
        {shown.map(entry => {
          const on = selected.includes(entry.path);
          return (
            <Pressable accessibilityRole="button" key={entry.path} onLongPress={() => setSelected(current => (current.includes(entry.path) ? current : [...current, entry.path]))} onPress={() => { void openEntry(entry); }} style={[styles.row, on && styles.rowOn]} testID={`fm-entry-${entry.isDirectory ? 'dir' : 'file'}`}>
              <EntryIcon kind={entry.isDirectory ? 'folder' : 'file'} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.name}>{entry.name}</Text>
                <Text numberOfLines={1} style={styles.meta}>{entry.isDirectory ? 'FOLDER' : formatBytes(entry.sizeBytes)}{entry.modifiedMs > 0 ? `  ·  ${formatDate(entry.modifiedMs)}` : ''}</Text>
              </View>
              <Pressable accessibilityLabel={`Actions for ${entry.name}`} accessibilityRole="button" onPress={() => setSheet(entry)} style={styles.more} testID="fm-more"><Text style={styles.moreText}>⋮</Text></Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
      {selected.length > 0 ? (
        <View style={styles.bar} testID="fm-selection-bar">
          <Text style={styles.barCount}>{selected.length} selected</Text>
          {([['copy', 'COPY'], ['cut', 'CUT'], ['compress', 'ZIP'], ['delete', 'DELETE']] as const).map(([action, label]) => (
            <Pressable accessibilityRole="button" key={action} onPress={() => {
              const first = shown.find(e => selected.includes(e.path));
              if (first !== undefined) sheetAction(first, action);
            }} style={styles.barButton} testID={`fm-bulk-${action}`}><Text style={styles.barText}>{label}</Text></Pressable>
          ))}
        </View>
      ) : clipboard !== undefined && !inFavorites ? (
        <View style={styles.bar} testID="fm-paste-bar">
          <Text numberOfLines={1} style={styles.barCount}>{clipboard.paths.length} to {clipboard.move ? 'move' : 'copy'}</Text>
          <Pressable accessibilityRole="button" onPress={() => setClipboard(undefined)} style={styles.barButton}><Text style={styles.barText}>CANCEL</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={doPaste} style={styles.primary} testID="fm-paste"><Text style={styles.primaryText}>PASTE HERE</Text></Pressable>
        </View>
      ) : null}

      <Modal animationType="fade" onRequestClose={() => setSheet(undefined)} transparent visible={sheet !== undefined}>
        <Pressable accessibilityRole="button" onPress={() => setSheet(undefined)} style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text numberOfLines={1} style={styles.sheetTitle}>{sheet?.name}</Text>
            {sheet !== undefined ? sheetRows(sheet).map(([action, label]) => (
              <Pressable accessibilityRole="button" key={action} onPress={() => sheetAction(sheet, action)} style={styles.sheetRow} testID={`fm-action-${action}`}>
                <Text style={[styles.sheetText, action === 'delete' && styles.danger]}>{label}</Text>
              </Pressable>
            )) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setCreateOpen(false)} transparent visible={createOpen}>
        <Pressable accessibilityRole="button" onPress={() => setCreateOpen(false)} style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Create</Text>
            {createActions.map(([label, run]) => (
              <Pressable accessibilityRole="button" key={label} onPress={() => { setCreateOpen(false); run(); }} style={styles.sheetRow} testID={`fm-create-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                <Text style={styles.sheetText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setPrompt(undefined)} transparent visible={prompt !== undefined}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{prompt?.title}</Text>
            {prompt !== undefined && prompt.action !== 'DELETE' ? (
              <TextInput autoCapitalize="none" autoCorrect={false} autoFocus onChangeText={setPromptValue} style={styles.promptInput} testID="fm-prompt-input" value={promptValue} />
            ) : null}
            <View style={styles.promptButtons}>
              <Pressable accessibilityRole="button" onPress={() => setPrompt(undefined)} style={styles.barButton} testID="fm-prompt-cancel"><Text style={styles.barText}>CANCEL</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => {
                const current = prompt;
                setPrompt(undefined);
                if (current !== undefined) current.onSubmit(promptValue.trim());
              }} style={styles.primary} testID="fm-prompt-ok"><Text style={styles.primaryText}>{prompt?.action}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setInfoData(undefined)} transparent visible={infoData !== undefined}>
        <Pressable accessibilityRole="button" onPress={() => setInfoData(undefined)} style={styles.backdrop}>
          <View style={styles.sheet} testID="fm-info">
            <Text style={styles.sheetTitle}>Information</Text>
            {infoData !== undefined ? (
              <>
                <Text style={styles.infoLine}>Name: {infoData.name}</Text>
                <Text style={styles.infoLine}>Path: {infoData.path}</Text>
                <Text style={styles.infoLine}>Size: {formatBytes(infoData.sizeBytes)}{infoData.truncated ? '+' : ''}</Text>
                {infoData.isDirectory ? <Text style={styles.infoLine}>Contains: {infoData.fileCount} files, {infoData.folderCount} folders</Text> : null}
                <Text style={styles.infoLine}>Modified: {formatDate(infoData.modifiedMs)}</Text>
                <Text style={styles.infoLine}>Access: {infoData.canRead ? 'read' : ''}{infoData.canWrite ? ' + write' : ''}</Text>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chips: {paddingHorizontal: 18, marginBottom: 8},
  chip: {borderColor: uiColors.border, borderRadius: 16, borderWidth: 1, marginRight: 8, paddingHorizontal: 12, paddingVertical: 7},
  chipOn: {backgroundColor: uiColors.accentSurface, borderColor: uiColors.accent},
  chipText: {color: uiColors.muted, fontFamily: UI_FONT_FAMILY, fontSize: 9, fontWeight: '800', letterSpacing: 0.6},
  chipTextOn: {color: uiColors.accent},
  toolbar: {alignItems: 'center', flexDirection: 'row', gap: 6, marginBottom: 8, paddingHorizontal: 18},
  where: {color: uiColors.muted, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 10, letterSpacing: 0.4},
  search: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 12, height: 38, paddingHorizontal: 10},
  tool: {alignItems: 'center', borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, height: 38, justifyContent: 'center', minWidth: 40, paddingHorizontal: 8},
  toolText: {color: uiColors.ink, fontSize: 18},
  toolTextSmall: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 8, fontWeight: '800'},
  toolAccent: {alignItems: 'center', backgroundColor: uiColors.accent, borderRadius: 8, height: 38, justifyContent: 'center', width: 40},
  toolAccentText: {color: '#0B0A06', fontSize: 22, fontWeight: '800'},
  banner: {alignItems: 'center', backgroundColor: uiColors.accentSurface, borderColor: uiColors.accent, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 8, marginHorizontal: 18, padding: 10},
  bannerText: {color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 11, lineHeight: 16},
  notice: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 11, marginBottom: 6, paddingHorizontal: 18},
  list: {paddingBottom: 90, paddingHorizontal: 18},
  row: {alignItems: 'center', backgroundColor: uiColors.panel, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 7, minHeight: 56, paddingLeft: 12},
  rowOn: {borderColor: uiColors.accent, backgroundColor: uiColors.accentSurface},
  copy: {flex: 1, marginLeft: 12, minWidth: 0},
  up: {color: uiColors.accent, fontSize: 18, marginRight: 14, width: 24},
  name: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '700'},
  meta: {color: uiColors.subdued, fontFamily: UI_FONT_FAMILY, fontSize: 8, letterSpacing: 0.3, marginTop: 4},
  more: {alignItems: 'center', height: 56, justifyContent: 'center', width: 44},
  moreText: {color: uiColors.accent, fontSize: 20, fontWeight: '800'},
  note: {color: uiColors.muted, fontFamily: UI_FONT_FAMILY, fontSize: 11, lineHeight: 17, marginVertical: 10},
  bar: {alignItems: 'center', backgroundColor: uiColors.panel, borderColor: uiColors.border, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10},
  barCount: {color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 11, fontWeight: '700'},
  barButton: {borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9},
  barText: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 9, fontWeight: '800', letterSpacing: 0.5},
  primary: {alignItems: 'center', backgroundColor: uiColors.accent, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10},
  primaryText: {color: '#0B0A06', fontFamily: UI_FONT_FAMILY, fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  disabled: {opacity: 0.35},
  backdrop: {backgroundColor: 'rgba(0,0,0,0.6)', flex: 1, justifyContent: 'flex-end'},
  sheet: {backgroundColor: uiColors.panel, borderColor: uiColors.border, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, padding: 16},
  sheetTitle: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '800', marginBottom: 8},
  sheetRow: {paddingVertical: 14},
  sheetText: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 14},
  danger: {color: '#FF8A7A'},
  promptInput: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 14, height: 44, marginVertical: 10, paddingHorizontal: 12},
  promptButtons: {flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8},
  infoLine: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 12, lineHeight: 20},
  editor: {flex: 1, paddingBottom: 12, paddingHorizontal: 12},
  editorBar: {alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8},
  editorName: {color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 11, fontWeight: '700'},
  editorInput: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: uiColors.ink, flex: 1, fontFamily: 'monospace', fontSize: 12, lineHeight: 18, padding: 10},
});
