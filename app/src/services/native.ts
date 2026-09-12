import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import { Image, Platform } from 'react-native';
import { createReminderScheduler } from './reminderScheduler';
import type { AppState } from '../types/models';
import { newId } from '../lib/id';
import { createBackup, materializeBackup, MAX_ASSET_BYTES, MAX_TOTAL_ASSET_BYTES } from '../domain/backup';
import { loadState } from '../storage/store';
import { reminderPlan } from '../domain/dates';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

function documents() {
  if (!FileSystem.documentDirectory) throw new Error('Local file storage is unavailable on this device.');
  return FileSystem.documentDirectory;
}

export function resolvePhotoUri(uri: string): string {
  if (uri.startsWith('handback-photo:')) {
    const filename = uri.slice('handback-photo:'.length);
    if (!/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(filename)) throw new Error('Invalid local photo reference.');
    return `${documents()}handback-photos/${filename}`;
  }
  if (!uri.startsWith('file://')) throw new Error('Photo must be stored on this phone.');
  return uri;
}

async function photoDirectory() {
  const path = `${documents()}handback-photos/`;
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  return path;
}

function photoType(base64: string): 'image/png' | 'image/webp' | 'image/jpeg' {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('UklGR')) return 'image/webp';
  throw new Error('Choose a JPEG, PNG, or WebP photo. This image format is not supported in portable backups.');
}

export async function pickPhoto(replacingToolId?: string): Promise<string | undefined> {
  // iOS's system photo picker grants access only to the selected item.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset) return;
  await Image.getSize(asset.uri);
  const contents = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const mimeType = photoType(contents);
  const imageBytes = contents.length / 4 * 3 - (contents.endsWith('==') ? 2 : contents.endsWith('=') ? 1 : 0);
  if (imageBytes > MAX_ASSET_BYTES) throw new Error('Choose a smaller photo (10 MiB maximum).');
  const state = await loadState();
  let totalBytes = imageBytes;
  for (const tool of state.tools) {
    if (!tool.photoUri || tool.id === replacingToolId) continue;
    const info = await FileSystem.getInfoAsync(resolvePhotoUri(tool.photoUri));
    if (!info.exists) throw new Error('An existing tool photo is missing. Remove or replace it before adding more photos.');
    totalBytes += info.size;
  }
  if (totalBytes > MAX_TOTAL_ASSET_BYTES) throw new Error('Choose a smaller photo or remove unused photos. HandBack supports 50 MiB of photos so every record can fit in a portable backup.');
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${await newId('photo')}.${extension}`;
  const target = `${await photoDirectory()}${filename}`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });
  return `handback-photo:${filename}`;
}

export async function exportBackup(state: AppState): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const raw = await createBackup(state, async (uri) => {
    const base64 = await FileSystem.readAsStringAsync(resolvePhotoUri(uri), { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = photoType(base64);
    return { base64, mimeType };
  });
  if (!FileSystem.cacheDirectory) throw new Error('Temporary file storage is unavailable.');
  const uri = `${FileSystem.cacheDirectory}HandBack-${await newId('backup')}.json`;
  await FileSystem.writeAsStringAsync(uri, raw);
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your HandBack backup' });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function pickBackup(): Promise<AppState | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json'], copyToCacheDirectory: true });
  if (result.canceled) return;
  const file = result.assets[0];
  if (!file) return;
  if (file.size && file.size > 100 * 1024 * 1024) throw new Error('This backup is too large (100 MB maximum).');
  const raw = await FileSystem.readAsStringAsync(file.uri);
  const staged: string[] = [];
  try {
    return await materializeBackup(raw, async (_id, asset) => {
      const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const filename = `${await newId('restored')}.${extension}`;
      const uri = `${await photoDirectory()}${filename}`;
      staged.push(uri);
      await FileSystem.writeAsStringAsync(uri, asset.base64, { encoding: FileSystem.EncodingType.Base64 });
      await Image.getSize(uri);
      return `handback-photo:${filename}`;
    });
  } catch (error) {
    await Promise.allSettled(staged.map(uri => FileSystem.deleteAsync(uri, { idempotent: true })));
    throw error;
  } finally {
    await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

const scheduleReminders = createReminderScheduler<ReturnType<typeof reminderPlan>[number]>({
  async list() {
    return (await Notifications.getAllScheduledNotificationsAsync()).map(item => item.identifier);
  },
  cancel: Notifications.cancelScheduledNotificationAsync,
  async schedule(plan) {
    const date = plan.date;
    await Notifications.scheduleNotificationAsync({
      identifier: plan.id,
      content: { title: plan.title, body: plan.body, sound: 'default', data: { loanId: plan.loanId } },
      trigger: Platform.OS === 'ios'
        ? { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: 9, minute: 0, second: 0, repeats: false }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  },
});

let reconciliation: Promise<void> = Promise.resolve();
export function reconcileReminders(state: AppState): Promise<void> {
  const operation = reconciliation.then(async () => {
    const permission = await Notifications.getPermissionsAsync();
    const allowed = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    await scheduleReminders(allowed ? reminderPlan(state) : []);
  });
  reconciliation = operation.catch(() => undefined);
  return operation;
}

/** Remove staged restore photos only when no committed record refers to them. */
export async function discardBackup(candidate: AppState): Promise<void> {
  let current: AppState;
  try { current = await loadState(); } catch { return; }
  const inUse = new Set(current.tools.map(tool => tool.photoUri));
  const staged = candidate.tools
    .map(tool => tool.photoUri)
    .filter((uri): uri is string => !!uri && uri.startsWith('handback-photo:restored_') && !inUse.has(uri));
  await Promise.allSettled(staged.map(uri => FileSystem.deleteAsync(resolvePhotoUri(uri), { idempotent: true })));
}
