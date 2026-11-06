import React from 'react';
import {ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {AGENT_CONFIGS, agentRoot, isValidNewFileName, type AgentConfig} from '../files/agentConfigs';
import {
  GUEST_FILE_PREVIEW_LIMIT_BYTES,
  listGuestDirectory,
  readGuestTextFile,
  writeGuestTextFile,
  type GuestFileEntry,
  type GuestFilePath,
} from '../files/fileExplorer';
import {ScreenShell} from '../screen/ScreenShell';
import {BrandBackButton, BrandHeader, uiColors} from './brand';
import {EntryIcon} from './EntryIcon';
import {InteractivePressable as Pressable} from './InteractivePressable';
import {UI_FONT_FAMILY} from './typography';
import {useHardwareBack} from './useHardwareBack';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function message(code: string): string {
  if (code === 'too_large') return `Too large to edit here (limit ${GUEST_FILE_PREVIEW_LIMIT_BYTES / 1024} KB).`;
  if (code === 'binary_or_invalid_text') return 'This file is not plain UTF-8 text, so it cannot be edited here.';
  if (code === 'not_found') return 'That file or folder is not there (yet). Open the tool once so it creates it.';
  if (code === 'invalid_path') return 'That path cannot be used.';
  return 'Something went wrong. Try again.';
}

type OpenFile = Readonly<{name: string; original: string; isNew: boolean}>;

type ConfigEditorScreenProps = Readonly<{
  agent: AgentConfig;
  onBack: () => void;
}>;

/** Browse one tool's settings folder and edit its text files in place. */
export function ConfigEditorScreen({agent, onBack}: ConfigEditorScreenProps): React.JSX.Element {
  const root = agentRoot(agent);
  const [path, setPath] = React.useState<GuestFilePath | undefined>(undefined);
  const [entries, setEntries] = React.useState<readonly GuestFileEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [file, setFile] = React.useState<OpenFile | undefined>();
  const [text, setText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | undefined>();
  const [newName, setNewName] = React.useState('');
  const [discardAsked, setDiscardAsked] = React.useState(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dirty = file !== undefined && (file.isNew ? true : text !== file.original);

  // Start inside the tool's own settings folder when it exists.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const candidate of agent.startCandidates) {
        const result = await listGuestDirectory(root, candidate);
        if (cancelled) return;
        if (result.kind === 'success') {
          setPath(candidate);
          return;
        }
      }
      if (!cancelled) setPath([]);
    })().catch(() => {
      if (!cancelled) setPath([]);
    });
    return () => {
      cancelled = true;
    };
  }, [agent, root]);

  const load = React.useCallback(async (directory: GuestFilePath) => {
    setLoading(true);
    setError(undefined);
    const result = await listGuestDirectory(root, directory);
    if (!mountedRef.current) return;
    if (result.kind === 'success') {
      const sorted = [...result.entries].sort((a, b) =>
        (a.kind === 'directory' ? 0 : 1) - (b.kind === 'directory' ? 0 : 1) || a.name.localeCompare(b.name));
      setEntries(sorted);
    } else {
      setEntries([]);
      setError(message(result.errorCode));
    }
    setLoading(false);
  }, [root]);

  React.useEffect(() => {
    if (path !== undefined) void load(path);
  }, [load, path]);

  const openFile = React.useCallback(async (name: string) => {
    if (path === undefined) return;
    setStatus(undefined);
    setError(undefined);
    const result = await readGuestTextFile(root, [...path, name]);
    if (!mountedRef.current) return;
    if (result.kind === 'success') {
      setFile({name, original: result.content, isNew: false});
      setText(result.content);
    } else {
      setError(message(result.errorCode));
    }
  }, [path, root]);

  const createFile = React.useCallback(() => {
    const name = newName.trim();
    if (!isValidNewFileName(name)) {
      setError('Use letters, numbers, dots, dashes and underscores for a file name.');
      return;
    }
    setNewName('');
    setError(undefined);
    setStatus(undefined);
    setFile({name, original: '', isNew: true});
    setText('');
  }, [newName]);

  const save = React.useCallback(async () => {
    if (file === undefined || path === undefined || saving) return;
    setSaving(true);
    setStatus(undefined);
    const result = await writeGuestTextFile(root, [...path, file.name], text);
    if (!mountedRef.current) return;
    setSaving(false);
    if (result.kind === 'ok') {
      setFile({name: file.name, original: text, isNew: false});
      setStatus('Saved');
      void load(path);
    } else {
      setStatus(message(result.errorCode));
    }
  }, [file, load, path, root, saving, text]);

  const closeFile = React.useCallback(() => {
    setFile(undefined);
    setText('');
    setStatus(undefined);
    setDiscardAsked(false);
  }, []);

  const goBack = React.useCallback((): boolean => {
    if (file !== undefined) {
      if (dirty && !discardAsked) {
        setDiscardAsked(true);
        setStatus('You have unsaved changes. Press back again to discard them.');
        return true;
      }
      closeFile();
      return true;
    }
    if (path !== undefined && path.length > 0) {
      setPath(path.slice(0, -1));
      return true;
    }
    onBack();
    return true;
  }, [closeFile, dirty, discardAsked, file, onBack, path]);
  useHardwareBack(true, goBack);

  const where = `${agent.label}${path === undefined || path.length === 0 ? '' : `  ›  ${path.join('/')}`}`;

  return (
    <ScreenShell testID="config-editor-screen">
      <BrandHeader eyebrow="CONFIG" title={agent.label} meta={null} action={<BrandBackButton onPress={() => { goBack(); }} testID="config-back" />} />
      {file === undefined ? (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Text numberOfLines={1} style={styles.where}>{where}</Text>
          {path !== undefined && path.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setPath(path.slice(0, -1))} style={styles.row} testID="config-up">
              <Text style={styles.upGlyph}>↑</Text>
              <Text style={styles.name}>Up one folder</Text>
            </Pressable>
          ) : null}
          {loading ? <Text style={styles.note}>Loading…</Text> : null}
          {!loading && error === undefined && entries.length === 0 ? <Text style={styles.note}>Nothing here yet. Open the tool once so it creates its files, or add a file below.</Text> : null}
          {entries.map(entry => {
            const openable = entry.kind === 'directory' || entry.kind === 'file';
            return (
              <Pressable
                accessibilityRole="button"
                disabled={!openable}
                key={entry.name}
                onPress={() => {
                  if (path === undefined) return;
                  if (entry.kind === 'directory') setPath([...path, entry.name]);
                  else void openFile(entry.name);
                }}
                style={[styles.row, !openable && styles.rowDisabled]}
                testID={`config-entry-${entry.kind}`}>
                <EntryIcon kind={entry.kind === 'directory' ? 'folder' : 'file'} />
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.name}>{entry.name}</Text>
                  <Text style={styles.meta}>{entry.kind === 'file' ? formatSize(entry.sizeBytes) : entry.kind.toUpperCase()}</Text>
                </View>
                {openable ? <Text style={styles.arrow}>{entry.kind === 'directory' ? '→' : 'EDIT'}</Text> : null}
              </Pressable>
            );
          })}
          {error !== undefined ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.newRow}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setNewName}
              onSubmitEditing={createFile}
              placeholder="new-file.json"
              placeholderTextColor={uiColors.subdued}
              style={styles.newInput}
              testID="config-new-name"
              value={newName}
            />
            <Pressable accessibilityRole="button" onPress={createFile} style={styles.addButton} testID="config-new-file">
              <Text style={styles.addText}>ADD FILE</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.editor}>
          <View style={styles.editorBar}>
            <Text numberOfLines={1} style={styles.editorName}>{file.name}{dirty ? ' •' : ''}</Text>
            <Pressable accessibilityRole="button" disabled={!dirty || saving} onPress={() => { void save(); }} style={[styles.saveButton, (!dirty || saving) && styles.saveDisabled]} testID="config-save">
              <Text style={styles.saveText}>{saving ? 'SAVING' : 'SAVE'}</Text>
            </Pressable>
          </View>
          {status !== undefined ? <Text style={styles.status}>{status}</Text> : null}
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={value => { setText(value); setDiscardAsked(false); setStatus(undefined); }}
            scrollEnabled
            spellCheck={false}
            style={styles.editorInput}
            testID="config-editor-input"
            textAlignVertical="top"
            value={text}
          />
        </View>
      )}
    </ScreenShell>
  );
}

export {AGENT_CONFIGS};

const styles = StyleSheet.create({
  list: {paddingBottom: 24, paddingHorizontal: 18},
  where: {color: uiColors.muted, fontFamily: UI_FONT_FAMILY, fontSize: 10, letterSpacing: 0.5, marginBottom: 10},
  row: {alignItems: 'center', backgroundColor: uiColors.panel, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', marginBottom: 7, minHeight: 56, paddingHorizontal: 12},
  rowDisabled: {opacity: 0.5},
  rowCopy: {flex: 1, minWidth: 0},
  upGlyph: {color: uiColors.accent, fontSize: 18, marginRight: 14, width: 24},
  name: {color: uiColors.ink, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '700'},
  meta: {color: uiColors.subdued, fontFamily: UI_FONT_FAMILY, fontSize: 8, letterSpacing: 0.3, marginTop: 4},
  arrow: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 9, fontWeight: '800', marginLeft: 8},
  note: {color: uiColors.muted, fontFamily: UI_FONT_FAMILY, fontSize: 11, lineHeight: 17, marginVertical: 10},
  error: {color: '#FF8A7A', fontFamily: UI_FONT_FAMILY, fontSize: 11, lineHeight: 17, marginVertical: 8},
  newRow: {alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 12},
  newInput: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 12, height: 42, paddingHorizontal: 12},
  addButton: {alignItems: 'center', backgroundColor: uiColors.accentSurface, borderColor: uiColors.accent, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', paddingHorizontal: 14},
  addText: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  editor: {flex: 1, paddingBottom: 12, paddingHorizontal: 12},
  editorBar: {alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8},
  editorName: {color: uiColors.ink, flex: 1, fontFamily: UI_FONT_FAMILY, fontSize: 12, fontWeight: '700'},
  saveButton: {alignItems: 'center', backgroundColor: uiColors.accent, borderRadius: 8, height: 38, justifyContent: 'center', paddingHorizontal: 18},
  saveDisabled: {opacity: 0.35},
  saveText: {color: '#0B0A06', fontFamily: UI_FONT_FAMILY, fontSize: 11, fontWeight: '800', letterSpacing: 0.6},
  status: {color: uiColors.accent, fontFamily: UI_FONT_FAMILY, fontSize: 11, marginBottom: 6},
  editorInput: {backgroundColor: uiColors.inset, borderColor: uiColors.border, borderRadius: 8, borderWidth: 1, color: uiColors.ink, flex: 1, fontFamily: 'monospace', fontSize: 12, lineHeight: 18, padding: 10},
});
