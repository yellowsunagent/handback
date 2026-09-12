import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/nav';
import { useApp } from '../ui/AppContext';
import { Button, Field, KeyboardScreen } from '../ui/components';
import { colors, common } from '../ui/theme';
import { discardBackup, pickBackup } from '../services/native';
import type { AppState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Setup'>;

export function SetupScreen(_props: Props) {
  const { commit, restore } = useApp();
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [restoreBusy, setRestoreBusy] = React.useState(false);
  const [restoreCandidate, setRestoreCandidate] = React.useState<AppState>();
  const lock = React.useRef(false);

  React.useEffect(() => {
    if (!restoreCandidate) return;
    return () => {
      void discardBackup(restoreCandidate);
    };
  }, [restoreCandidate]);

  async function finishSetup() {
    const cleaned = name.trim();
    if (!cleaned || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      await commit({ type: 'profile', name: cleaned });
    } catch (error) {
      Alert.alert('Could not finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  async function chooseRestore() {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const candidate = await pickBackup();
      if (candidate) setRestoreCandidate(candidate);
    } catch (error) {
      Alert.alert('Could not read backup', error instanceof Error ? error.message : 'The backup was rejected. Your current records are unchanged.');
    } finally {
      setRestoreBusy(false);
    }
  }

  function confirmRestore() {
    if (!restoreCandidate || restoreBusy) return;
    const candidate = restoreCandidate;
    Alert.alert('Use this backup?', `It contains ${candidate.people.length} people, ${candidate.tools.length} tools, and ${candidate.loans.length} loans. It will replace records on this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Use backup', onPress: () => { void performRestore(candidate); } },
    ]);
  }

  async function performRestore(candidate: AppState) {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const result = await restore(candidate);
      Alert.alert('Backup restored', result.reminderError
        ? 'Your records are restored. Local reminders could not be refreshed; use Retry in the reminder banner.'
        : 'Your HandBack records are ready on this phone.');
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'The backup could not replace local data.');
    } finally {
      setRestoreCandidate(undefined);
      setRestoreBusy(false);
    }
  }

  return (
    <KeyboardScreen>
      <View style={styles.hero}>
        <Text style={styles.mark}>↩</Text>
        <Text style={common.title}>Welcome to HandBack</Text>
        <Text style={common.subtitle}>
          Keep a simple local record of the tools you lend and the tools you need to return.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Start with your name</Text>
        <Text style={common.note}>
          It is used to identify you on this phone. HandBack does not need an account or access to your contacts.
        </Text>
      </View>

      <Field
        label="Your display name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Jason"
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={() => void finishSetup()}
      />
      <Button label="Get started" onPress={() => void finishSetup()} variant="primary" busy={saving} disabled={!name.trim()} />
      <Button label="Restore from backup" onPress={() => void chooseRestore()} variant="quiet" busy={restoreBusy} disabled={saving} style={styles.restoreButton} />
      {restoreCandidate ? (
        <View style={styles.restoreCard}>
          <Text style={styles.restoreTitle}>Backup ready for review</Text>
          <Text style={common.note}>{restoreCandidate.people.length} people · {restoreCandidate.tools.length} tools · {restoreCandidate.loans.length} loans</Text>
          <Text style={styles.restoreBody}>Using it replaces local records, including history, photos, and reminder preferences.</Text>
          <Button label="Review and use backup" onPress={confirmRestore} variant="secondary" disabled={restoreBusy} />
          <Button label="Cancel" onPress={() => setRestoreCandidate(undefined)} variant="quiet" disabled={restoreBusy} />
        </View>
      ) : null}
      <Text style={styles.footer}>Your records stay on this device unless you choose to share a backup.</Text>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 58, marginBottom: 30 },
  mark: { color: colors.primary, fontSize: 44, fontWeight: '300', marginBottom: 16 },
  infoCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginBottom: 25, padding: 16 },
  infoTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  footer: { color: colors.dim, fontSize: 12, lineHeight: 17, marginTop: 18, textAlign: 'center' },
  restoreButton: { marginTop: 7 },
  restoreCard: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, marginTop: 17, padding: 15 },
  restoreTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  restoreBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 13, marginTop: 8 },
});
