import {NativeModules, PermissionsAndroid, Platform, type Permission} from 'react-native';

export type FmRoot = Readonly<{id: string; label: string; path: string; writable: boolean}>;

export type FmEntry = Readonly<{
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  sizeBytes: number;
  modifiedMs: number;
  canWrite: boolean;
}>;

export type FmInfo = Readonly<{
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  fileCount: number;
  folderCount: number;
  modifiedMs: number;
  canRead: boolean;
  canWrite: boolean;
  truncated: boolean;
}>;

type NativeFiles = Readonly<{
  getRoots(): Promise<FmRoot[]>;
  storageAccess(): Promise<boolean>;
  requestStorageAccess(): Promise<boolean>;
  listDir(path: string): Promise<{path: string; entries: FmEntry[]}>;
  search(path: string, query: string): Promise<FmEntry[]>;
  makeDirectory(parent: string, name: string): Promise<string>;
  createFile(parent: string, name: string): Promise<string>;
  deletePaths(paths: string[]): Promise<number>;
  renamePath(path: string, newName: string): Promise<string>;
  paste(sources: string[], destination: string, move: boolean): Promise<number>;
  info(path: string): Promise<FmInfo>;
  compress(sources: string[], destination: string, name: string): Promise<string>;
  extract(path: string): Promise<string>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<boolean>;
  share(path: string): Promise<boolean>;
  getFavorites(): Promise<string[]>;
  setFavorite(path: string, favorite: boolean): Promise<boolean>;
  pickAndImport(destination: string): Promise<number>;
}>;

export type FmResult<T> = Readonly<{ok: true; value: T}> | Readonly<{ok: false; code: string}>;

function native(): NativeFiles | undefined {
  return NativeModules.XCombFiles as NativeFiles | undefined;
}

async function call<T>(fn: (module: NativeFiles) => Promise<T>): Promise<FmResult<T>> {
  const module = native();
  if (module === undefined) return {ok: false, code: 'unavailable'};
  try {
    return {ok: true, value: await fn(module)};
  } catch (error) {
    const code = (error as {code?: unknown} | null)?.code;
    return {ok: false, code: typeof code === 'string' ? code : 'failed'};
  }
}

/**
 * Android 7-10 uses runtime storage permissions; All files access exists only
 * from Android 11. Requesting the old permissions here keeps phone storage
 * usable on every supported Android version.
 */
async function requestLegacyStorageAccess(): Promise<boolean> {
  const permissions: Permission[] = [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
  if (Number(Platform.Version) <= 28) {
    permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export const fm = {
  roots: () => call(m => m.getRoots()),
  storageAccess: () => call(m => m.storageAccess()),
  requestStorageAccess: async (): Promise<FmResult<boolean>> => {
    if (Platform.OS === 'android' && Number(Platform.Version) < 30) {
      try {
        return {ok: true, value: await requestLegacyStorageAccess()};
      } catch {
        return {ok: false, code: 'permission_denied'};
      }
    }
    return call(m => m.requestStorageAccess());
  },
  list: (path: string) => call(m => m.listDir(path)),
  search: (path: string, query: string) => call(m => m.search(path, query)),
  mkdir: (parent: string, name: string) => call(m => m.makeDirectory(parent, name)),
  createFile: (parent: string, name: string) => call(m => m.createFile(parent, name)),
  remove: (paths: readonly string[]) => call(m => m.deletePaths([...paths])),
  rename: (path: string, name: string) => call(m => m.renamePath(path, name)),
  paste: (sources: readonly string[], destination: string, move: boolean) => call(m => m.paste([...sources], destination, move)),
  info: (path: string) => call(m => m.info(path)),
  compress: (sources: readonly string[], destination: string, name: string) => call(m => m.compress([...sources], destination, name)),
  extract: (path: string) => call(m => m.extract(path)),
  readText: (path: string) => call(m => m.readText(path)),
  writeText: (path: string, content: string) => call(m => m.writeText(path, content)),
  share: (path: string) => call(m => m.share(path)),
  favorites: () => call(m => m.getFavorites()),
  setFavorite: (path: string, favorite: boolean) => call(m => m.setFavorite(path, favorite)),
  importFiles: (destination: string) => call(m => m.pickAndImport(destination)),
};

export function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function isArchive(name: string): boolean {
  return /\.(zip|jar|apk)$/i.test(name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatDate(ms: number): string {
  if (!(ms > 0)) return '';
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function errorMessage(code: string): string {
  switch (code) {
    case 'exists': return 'A file or folder with that name already exists.';
    case 'invalid_name': return 'That name cannot be used.';
    case 'invalid_path': return 'That location is not allowed.';
    case 'permission_denied': return 'Permission denied. Grant All files access first.';
    case 'too_large': return 'Too large for this action.';
    case 'binary_or_invalid_text': return 'Not a plain text file, so it cannot be edited here.';
    case 'into_itself': return 'You cannot put a folder inside itself.';
    case 'unsafe_entry': return 'The archive has an unsafe path and was not extracted.';
    case 'unavailable': return 'The file manager needs the Android app.';
    default: return 'Something went wrong. Try again.';
  }
}
