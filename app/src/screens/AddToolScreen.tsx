import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../types/nav';
import type { Tool } from '../types/models';
import { newId } from '../lib/id';
import { pickPhoto } from '../services/native';
import { useApp } from '../ui/AppContext';
import { Button, Card, Field, Header, KeyboardScreen, PersonPicker, PhotoThumbnail } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTool'>;

export function AddToolScreen({ route, navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const params = route.params ?? {};
  const toolId = params.toolId;
  const existing = state?.tools.find((tool) => tool.id === toolId);
  const [name, setName] = React.useState('');
  const [ownerId, setOwnerId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [photoUri, setPhotoUri] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  React.useEffect(() => {
    if (!state) return;
    const tool = state.tools.find((item) => item.id === toolId);
    setName(tool?.name ?? '');
    setOwnerId(tool?.ownerId ?? params.ownerId ?? state.profileId);
    setNotes(tool?.notes ?? '');
    setPhotoUri(tool?.photoUri);
  }, [state, toolId, params.ownerId]);

  if (!state) return null;
  const activeLoan = state.loans.find((loan) => loan.toolId === toolId && !loan.returnedOn);
  const editing = !!existing;

  async function onChoosePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const next = await pickPhoto(existing?.id);
      if (next) setPhotoUri(next);
    } catch (error) {
      Alert.alert('Could not choose photo', error instanceof Error ? error.message : 'Photo access is optional. You can continue without one.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSave() {
    const cleaned = name.trim();
    if (!cleaned || !ownerId || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      const tool: Tool = {
        id: existing?.id ?? await newId('tool'),
        name: cleaned,
        ownerId,
        notes: notes.trim() || undefined,
        photoUri,
        archived: existing?.archived,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await commit({ type: 'tool', tool });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save tool', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  function onArchive() {
    if (!existing) return;
    if (activeLoan) {
      Alert.alert('Resolve the active loan first', 'A tool stays available in your inventory until its active loan is returned or deleted.');
      return;
    }
    const archive = !existing.archived;
    Alert.alert(archive ? `Archive ${existing.name}?` : `Restore ${existing.name}?`, archive ? 'It will stay in history but be hidden from future loan selections.' : 'It will appear in future tool selections again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: archive ? 'Archive' : 'Restore',
        onPress: () => {
          void commit({ type: 'tool', tool: { ...existing, archived: archive } }).then(() => navigation.goBack()).catch((error) => {
            Alert.alert('Could not update tool', error instanceof Error ? error.message : 'Please try again.');
          });
        },
      },
    ]);
  }

  return (
    <KeyboardScreen>
      <Header title={editing ? 'Edit tool' : 'Add a tool'} subtitle={editing ? 'Correct the details while keeping this tool’s identity and history.' : 'A tool can be saved without a photo or detailed notes.'} onBack={() => navigation.goBack()} />

      <View style={styles.photoRow}>
        <PhotoThumbnail uri={photoUri} size={88} />
        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>Tool photo</Text>
          <Text style={common.note}>Optional. A photo stays on this device and is included in backups.</Text>
          <View style={styles.photoActions}>
            <Button label={photoBusy ? 'Choosing…' : photoUri ? 'Change photo' : 'Choose photo'} onPress={() => void onChoosePhoto()} variant="secondary" disabled={photoBusy} style={styles.photoButton} />
            {photoUri ? <Pressable accessibilityRole="button" onPress={() => setPhotoUri(undefined)}><Text style={styles.removePhoto}>Remove</Text></Pressable> : null}
          </View>
        </View>
      </View>

      <Field label="Tool name" value={name} onChangeText={setName} placeholder="e.g. 18V drill" autoFocus={!editing} maxLength={80} />
      <PersonPicker label="Owner" people={state.people} value={ownerId} onChange={setOwnerId} placeholder="Choose the owner" />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Brand, model, battery and charger details" multiline maxLength={500} />

      <Button label={editing ? 'Save changes' : 'Save tool'} onPress={() => void onSave()} variant="primary" busy={saving} disabled={!name.trim() || !ownerId} />
      {editing ? <Button label={existing?.archived ? 'Restore tool' : 'Archive tool'} onPress={onArchive} variant="quiet" disabled={saving} /> : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  photoRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 24 },
  photoCopy: { flex: 1, marginLeft: 14 },
  photoTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  photoActions: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 10 },
  photoButton: { minHeight: 38, paddingHorizontal: 11, paddingVertical: 8 },
  removePhoto: { color: colors.danger, fontSize: 12, fontWeight: '800' },
});
