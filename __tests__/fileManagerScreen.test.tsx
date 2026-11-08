import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FileManagerScreen} from '../src/ui/FileManagerScreen';
import {fm} from '../src/files/fileManager';

jest.mock('../src/files/fileManager', () => {
  const actual = jest.requireActual('../src/files/fileManager');
  const ok = <T,>(value: T) => Promise.resolve({ok: true, value});
  return {
    ...actual,
    fm: {
      roots: jest.fn(() => ok([
        {id: 'storage', label: 'Phone storage', path: '/storage/emulated/0', writable: true},
        {id: 'home', label: 'Linux home', path: '/data/xcomb/home', writable: true},
        {id: 'agent:opencode', label: 'opencode', path: '/data/xcomb/harness-homes/opencode', writable: true},
      ])),
      storageAccess: jest.fn(() => ok(false)),
      requestStorageAccess: jest.fn(() => ok(true)),
      list: jest.fn(() => ok({path: '/storage/emulated/0', entries: [
        {name: 'Download', path: '/storage/emulated/0/Download', isDirectory: true, isSymlink: false, sizeBytes: 0, modifiedMs: 1, canWrite: true},
        {name: 'pack.zip', path: '/storage/emulated/0/pack.zip', isDirectory: false, isSymlink: false, sizeBytes: 2048, modifiedMs: 1, canWrite: true},
      ]})),
      search: jest.fn(() => ok([])),
      mkdir: jest.fn(() => ok('/storage/emulated/0/New')),
      createFile: jest.fn(() => ok('x')),
      remove: jest.fn(() => ok(1)),
      rename: jest.fn(() => ok('x')),
      paste: jest.fn(() => ok(1)),
      info: jest.fn(() => ok({name: 'pack.zip', path: '/p', isDirectory: false, sizeBytes: 2048, fileCount: 1, folderCount: 0, modifiedMs: 1, canRead: true, canWrite: true, truncated: false})),
      compress: jest.fn(() => ok('z')),
      extract: jest.fn(() => ok('e')),
      readText: jest.fn(() => ok('hello')),
      writeText: jest.fn(() => ok(true)),
      share: jest.fn(() => ok(true)),
      favorites: jest.fn(() => ok([])),
      setFavorite: jest.fn(() => ok(true)),
      importFiles: jest.fn(() => ok(2)),
    },
  };
});

async function render(props: Partial<React.ComponentProps<typeof FileManagerScreen>> = {}) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<FileManagerScreen onBack={() => undefined} {...props} />);
  });
  return renderer;
}

const press = async (renderer: ReactTestRenderer.ReactTestRenderer, testID: string, index = 0) => {
  await ReactTestRenderer.act(async () => {
    renderer.root.findAll(n => n.props.testID === testID && typeof n.props.onPress === 'function')[index]?.props.onPress();
  });
};

describe('FileManagerScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists phone storage and asks for All files access', async () => {
    const renderer = await render();
    const texts = renderer.root.findAllByType(Text).map(n => n.props.children).flat().join(' ');
    expect(texts).toContain('Download');
    expect(texts).toContain('pack.zip');
    expect(renderer.root.findAll(n => n.props.testID === 'fm-grant').length).toBeGreaterThan(0);
    await press(renderer, 'fm-grant');
    expect(fm.requestStorageAccess).toHaveBeenCalled();
  });

  it('creates a folder through the create menu', async () => {
    const renderer = await render();
    await press(renderer, 'fm-create');
    await press(renderer, 'fm-create-new-folder');
    await ReactTestRenderer.act(async () => {
      renderer.root.findByProps({testID: 'fm-prompt-input'}).props.onChangeText('Projects');
    });
    await press(renderer, 'fm-prompt-ok');
    expect(fm.mkdir).toHaveBeenCalledWith('/storage/emulated/0', 'Projects');
  });

  it('offers archive, copy, cut, delete, rename, info and favorites actions', async () => {
    const renderer = await render();
    const archiveMenu = renderer.root.findAll(
      n => n.props.accessibilityLabel === 'Actions for pack.zip' && typeof n.props.onPress === 'function',
    );
    expect(archiveMenu.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => { archiveMenu[0].props.onPress(); });
    for (const action of ['archive', 'compress', 'info', 'copy', 'cut', 'delete', 'rename', 'share', 'favorite']) {
      expect(renderer.root.findAll(n => n.props.testID === `fm-action-${action}`).length).toBeGreaterThan(0);
    }
    await press(renderer, 'fm-action-archive');
    expect(fm.extract).toHaveBeenCalledWith('/storage/emulated/0/pack.zip');
  });

  it('copies then pastes into the current folder', async () => {
    const renderer = await render();
    await press(renderer, 'fm-more', 0);
    await press(renderer, 'fm-action-copy');
    await press(renderer, 'fm-paste');
    expect(fm.paste).toHaveBeenCalledWith(['/storage/emulated/0/Download'], '/storage/emulated/0', false);
  });

  it('imports phone files into the current folder', async () => {
    const renderer = await render();
    await press(renderer, 'fm-create');
    await press(renderer, 'fm-create-import-from-phone');
    expect(fm.importFiles).toHaveBeenCalledWith('/storage/emulated/0');
  });

  it('opens an agent folder locked to its root', async () => {
    const renderer = await render({initialRootId: 'agent:opencode', lockRoot: true, startCandidates: [['.config', 'opencode']]});
    expect(fm.list).toHaveBeenCalledWith('/data/xcomb/harness-homes/opencode/.config/opencode');
    expect(renderer.root.findAll(n => n.props.testID === 'fm-root-storage').length).toBe(0);
  });
});
