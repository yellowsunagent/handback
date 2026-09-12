import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { AppState } from '../types/models';
import type { RootStackParamList } from '../types/nav';
import { discardBackup, exportBackup, pickBackup } from '../services/native';
import { useApp } from '../ui/AppContext';
import { Button, Card, Field, Header, KeyboardScreen } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function counts(state: AppState) {
  return `${state.people.length} people · ${state.tools.length} tools · ${state.loans.length} loans`;
}

export function SettingsScreen({ navigation }: Props) {
  const { state, refresh, commit, restore } = useApp();
  const [name, setName] = React.useState('');
  const [savingName, setSavingName] = React.useState(false);
  const [backupBusy, setBackupBusy] = React.useState(false);
  const [restoreCandidate, setRestoreCandidate] = React.useState<AppState>();
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  React.useEffect(() => {
    if (!state) return;
    setName(state.people.find((person) => person.id === state.profileId)?.name ?? '');
  }, [state]);

  React.useEffect(() => {
    if (!restoreCandidate) return;
    return () => {
      void discardBackup(restoreCandidate);
    };
  }, [restoreCandidate]);

  if (!state) return null;
  const currentState = state;

  async function saveName() {
    const cleaned = name.trim();
    if (!cleaned || savingName) return;
    setSavingName(true);
    try {
      await commit({ type: 'profile', name: cleaned });
      Alert.alert('Profile updated', 'Your existing loans and ownership records stayed attached to the same local identity.');
    } catch (error) {
      Alert.alert('Could not update profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingName(false);
    }
  }

  async function exportCurrent() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      await exportBackup(currentState);
      Alert.alert('Share sheet opened', 'Choose where to keep your HandBack backup. If you cancel the share sheet, no backup is saved elsewhere.');
    } catch (error) {
      Alert.alert('Could not open backup export', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function chooseRestore() {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const candidate = await pickBackup();
      if (candidate) setRestoreCandidate(candidate);
    } catch (error) {
      Alert.alert('Could not read backup', error instanceof Error ? error.message : 'The backup was rejected and your current records are unchanged.');
    } finally {
      setBackupBusy(false);
    }
  }

  function replaceWithCandidate() {
    if (!restoreCandidate || lock.current) return;
    const candidate = restoreCandidate;
    Alert.alert('Replace local data?', `Restore will replace this phone’s current records with ${counts(candidate)}. This cannot merge the two datasets.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export current first', onPress: () => { void exportCurrent().then(() => replaceWithCandidate()); } },
      { text: 'Replace local data', style: 'destructive', onPress: () => { void performRestore(candidate); } },
    ]);
  }

  async function performRestore(candidate: AppState) {
    if (lock.current) return;
    lock.current = true;
    setBackupBusy(true);
    try {
      const result = await restore(candidate);
      Alert.alert('Data restored', result.reminderError
        ? 'Your records were restored. Local reminders could not be refreshed; use Retry in the reminder banner.'
        : 'Your HandBack records are now restored on this phone.');
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Your current records were preserved.');
    } finally {
      setRestoreCandidate(undefined);
      lock.current = false;
      setBackupBusy(false);
    }
  }

  return (
    <KeyboardScreen>
      <Header title="Settings" subtitle="HandBack stays local. Use a backup when you want a portable copy." onBack={() => navigation.goBack()} />

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionKicker}>YOUR PROFILE</Text>
        <Field label="Display name" value={name} onChangeText={setName} placeholder="e.g. Jason" maxLength={40} />
        <Button label="Save name" onPress={() => void saveName()} variant="primary" busy={savingName} disabled={!name.trim()} />
        <Text style={styles.help}>Changing this name does not rename or merge any other person.</Text>
      </Card>

      <Button label="Manage people" onPress={() => navigation.navigate('People')} variant="secondary" style={styles.button} />
      <Button label="Export a backup" onPress={() => void exportCurrent()} variant="secondary" busy={backupBusy} style={styles.button} />
      <Button label="Restore from backup" onPress={() => void chooseRestore()} variant="secondary" busy={backupBusy} style={styles.button} />

      {restoreCandidate ? (
        <Card style={styles.previewCard}>
          <Text style={styles.previewKicker}>BACKUP READY FOR REVIEW</Text>
          <Text style={styles.previewTitle}>This backup is staged safely</Text>
          <Text style={common.note}>{counts(restoreCandidate)}</Text>
          <Text style={styles.previewBody}>Restore replaces local records, including archive state, history, reminder preferences, and accessible photos. Your current records stay unchanged until you explicitly choose Replace local data.</Text>
          <Button label="Review replacement" onPress={replaceWithCandidate} variant="primary" disabled={backupBusy} />
          <Button label="Cancel restore" onPress={() => setRestoreCandidate(undefined)} variant="quiet" disabled={backupBusy} />
        </Card>
      ) : null}

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>Local records</Text>
        <Text style={common.note}>{counts(state)}</Text>
        <Text style={common.note}>Photos and private notes stay on this device and are included in backups. Shared QR codes contain only the details needed to save a loan copy.</Text>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  sectionCard: { marginBottom: 14 },
  sectionKicker: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 14 },
  help: { color: colors.dim, fontSize: 12, lineHeight: 17, marginTop: 11 },
  button: { marginBottom: 10 },
  previewCard: { borderColor: '#83672c', marginTop: 13 },
  previewKicker: { color: colors.warning, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  previewTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 5 },
  previewBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 15, marginTop: 10 },
  about: { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 25, paddingTop: 17 },
  aboutTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 6 },
});
