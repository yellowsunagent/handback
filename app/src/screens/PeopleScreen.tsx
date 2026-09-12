import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { Person } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { newId } from '../lib/id';
import { useApp } from '../ui/AppContext';
import { Button, Card, EmptyState, Field, Header, Screen } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'People'>;

export function PeopleScreen({ navigation }: Props) {
  const { state, refresh, commit } = useApp();
  const [editor, setEditor] = React.useState<Person | 'new' | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  if (!state) return null;
  const currentState = state;
  const profile = currentState.people.find((person) => person.id === currentState.profileId);
  const activePeople = currentState.people.filter((person) => !person.archived);
  const archivedPeople = currentState.people.filter((person) => person.archived);

  async function savePerson(name: string, note: string) {
    const cleaned = name.trim();
    if (!cleaned || saving) return;
    setSaving(true);
    try {
      const current = editor !== 'new' && editor ? editor : undefined;
      const person: Person = {
        id: current?.id ?? await newId('person'),
        name: cleaned,
        note: note.trim() || undefined,
        archived: current?.archived,
      };
      await commit({ type: 'person', person });
      setEditor(null);
    } catch (error) {
      Alert.alert('Could not save person', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function archivePerson(person: Person) {
    if (person.id === currentState.profileId) {
      Alert.alert('That is you', 'Your profile stays available so ownership remains clear.');
      return;
    }
    const action = person.archived ? 'Restore' : 'Archive';
    Alert.alert(`${action} ${person.name}?`, person.archived ? 'This person will be available in future selections again.' : 'Historical loans will still show this person.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        onPress: () => {
          void commit({ type: 'person', person: { ...person, archived: !person.archived } }).catch((error) => {
            Alert.alert(`Could not ${action.toLocaleLowerCase()} person`, error instanceof Error ? error.message : 'Please try again.');
          });
        },
      },
    ]);
  }

  return (
    <Screen>
      <Header title="People" subtitle="Keep people handy and use notes to distinguish friends with the same name." onBack={() => navigation.goBack()} action={<Button label="+ Add" onPress={() => setEditor('new')} variant="secondary" style={styles.addButton} />} />

      <Card style={styles.profileCard}>
        <Text style={styles.cardKicker}>THIS PHONE</Text>
        <Text style={styles.profileName}>{profile?.name ?? 'Your profile'}</Text>
        <Text style={common.note}>Your profile is used as “me” in lending and borrowing records.</Text>
      </Card>

      <Text style={common.sectionTitle}>People you know</Text>
      {activePeople.filter((person) => person.id !== currentState.profileId).length === 0 ? (
        <EmptyState title="No other people yet" body="Add someone when you record your first loan. You can keep two people with the same name separate with a note." action={<Button label="Add a person" onPress={() => setEditor('new')} variant="secondary" />} />
      ) : (
        activePeople.filter((person) => person.id !== currentState.profileId).map((person) => <PersonRow key={person.id} person={person} onEdit={() => setEditor(person)} onArchive={() => archivePerson(person)} />)
      )}

      {archivedPeople.length > 0 ? (
        <View style={styles.archivedBlock}>
          <Pressable accessibilityRole="button" style={styles.archivedHeader} onPress={() => setShowArchived((value) => !value)}>
            <Text style={styles.archivedTitle}>Archived people ({archivedPeople.length})</Text>
            <Text style={styles.link}>{showArchived ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {showArchived ? archivedPeople.map((person) => <PersonRow key={person.id} person={person} onEdit={() => setEditor(person)} onArchive={() => archivePerson(person)} archived />) : null}
        </View>
      ) : null}

      <PersonEditor person={editor} saving={saving} onClose={() => setEditor(null)} onSave={savePerson} />
    </Screen>
  );
}

function PersonRow({ person, onEdit, onArchive, archived = false }: { person: Person; onEdit: () => void; onArchive: () => void; archived?: boolean }) {
  return (
    <Card style={[styles.personCard, archived && styles.archivedCard]}>
      <View style={styles.personMain}>
        <Text style={styles.personName}>{person.name}</Text>
        {person.note ? <Text style={common.note}>{person.note}</Text> : null}
      </View>
      <View style={styles.personActions}>
        <Pressable accessibilityRole="button" onPress={onEdit}><Text style={styles.link}>Edit</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onArchive}><Text style={styles.mutedLink}>{archived ? 'Restore' : 'Archive'}</Text></Pressable>
      </View>
    </Card>
  );
}

function PersonEditor({ person, saving, onClose, onSave }: { person: Person | 'new' | null; saving: boolean; onClose: () => void; onSave: (name: string, note: string) => Promise<void> }) {
  const [name, setName] = React.useState('');
  const [note, setNote] = React.useState('');
  React.useEffect(() => {
    if (!person) return;
    setName(person === 'new' ? '' : person.name);
    setNote(person === 'new' ? '' : person.note ?? '');
  }, [person]);
  return (
    <Modal visible={!!person} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <SafeAreaView edges={['bottom']} style={styles.modalCard}>
          <Text style={styles.modalTitle}>{person === 'new' ? 'Add a person' : 'Edit person'}</Text>
          <Text style={[common.note, styles.modalIntro]}>The note is private to this phone and helps distinguish people with the same name.</Text>
          <Field label="Name" value={name} onChangeText={setName} autoFocus placeholder="e.g. Chris" maxLength={40} />
          <Field label="Distinguishing note (optional)" value={note} onChangeText={setNote} placeholder="e.g. next-door neighbor" maxLength={80} />
          <Button label="Save" onPress={() => void onSave(name, note)} variant="primary" busy={saving} disabled={!name.trim()} />
          <Button label="Cancel" onPress={onClose} variant="quiet" disabled={saving} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  addButton: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 9 },
  profileCard: { marginBottom: 26 },
  cardKicker: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginBottom: 5 },
  profileName: { color: colors.ink, fontSize: 21, fontWeight: '800', marginBottom: 5 },
  personCard: { alignItems: 'center', flexDirection: 'row', marginBottom: 9, paddingVertical: 13 },
  personMain: { flex: 1 },
  personName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  personActions: { alignItems: 'flex-end', gap: 10 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  mutedLink: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  archivedBlock: { marginTop: 16 },
  archivedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  archivedTitle: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  archivedCard: { opacity: 0.68 },
  modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.62)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.canvas, borderColor: colors.line, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  modalTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', marginBottom: 8 },
  modalIntro: { marginBottom: 17 },
});
