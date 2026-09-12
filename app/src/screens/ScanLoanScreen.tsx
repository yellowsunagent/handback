import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { LoanPayload } from '../domain/qr';
import { importLoanQR, parseLoanQR } from '../domain/qr';
import type { RootStackParamList } from '../types/nav';
import { useApp } from '../ui/AppContext';
import { Button, Card, Header, Screen } from '../ui/components';
import { colors, common } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanLoan'>;

export function ScanLoanScreen({ navigation }: Props) {
  const { state, refresh, apply } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = React.useState<LoanPayload>();
  const [scanError, setScanError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);
  const lock = React.useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  React.useEffect(() => {
    if (!permission) void requestPermission().catch(() => setScanError('Camera access could not be requested. You can record the loan manually.'));
  }, [permission, requestPermission]);

  if (!state) return null;
  const existing = payload ? state.loans.find((loan) => loan.id === payload.loanId) : undefined;

  function onScan(raw: string) {
    if (payload || lock.current) return;
    try {
      const parsed = parseLoanQR(raw);
      setPayload(parsed);
      setScanError(undefined);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'That code is not a supported HandBack loan.');
    }
  }

  async function saveCopy() {
    if (!payload || saving || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      const next = await apply((previous) => importLoanQR(previous, payload));
      const saved = next.loans.find((loan) => loan.id === payload.loanId);
      if (!saved) throw new Error('The loan copy could not be saved.');
      Alert.alert(existing ? 'Loan already saved' : 'Copy saved', existing ? 'The original local record was kept exactly as it is. Re-scanning never overwrites edits or a recorded return.' : 'This phone now has its own local record. It records the local user as the borrower and does not notify the owner or sync later changes.', [{ text: 'Open loan', onPress: () => navigation.replace('LoanDetail', { loanId: saved.id }) }]);
    } catch (error) {
      Alert.alert('Could not save QR copy', error instanceof Error ? error.message : 'No local changes were made. Please try again.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  const permissionDenied = permission?.granted === false;
  return (
    <Screen>
      <Header title="Save a QR copy" subtitle="Scan an owner’s saved loan, review the details, then choose whether to keep a copy here." onBack={() => navigation.goBack()} />
      {!permissionDenied ? (
        <View style={styles.cameraFrame}>
          {permission?.granted ? <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={payload ? undefined : ({ data }) => onScan(data)} /> : <Text style={styles.cameraStatus}>Requesting camera access…</Text>}
        </View>
      ) : (
        <Card style={styles.permissionCard}>
          <Text style={styles.cardTitle}>Camera access is off</Text>
          <Text style={common.note}>You can still record a loan manually. Camera access is optional and can be enabled later in Settings.</Text>
          {permission?.canAskAgain ? <Button label="Allow camera" onPress={() => void requestPermission().catch(() => setScanError('Camera access could not be requested. You can record the loan manually.'))} variant="secondary" style={styles.cardButton} /> : null}
          <Button label="Record manually" onPress={() => navigation.replace('StartLoan', { mode: 'borrow' })} variant="primary" style={styles.cardButton} />
        </Card>
      )}

      {scanError ? <Card style={styles.errorCard}><Text style={styles.errorTitle}>Could not read that code</Text><Text style={common.note}>{scanError}</Text><Button label="Scan again" onPress={() => setScanError(undefined)} variant="quiet" style={styles.cardButton} /></Card> : null}

      {payload ? (
        <Card style={styles.reviewCard}>
          <Text style={styles.reviewKicker}>{existing ? 'ALREADY ON THIS PHONE' : 'REVIEW BEFORE SAVING'}</Text>
          <Text style={styles.reviewTitle}>{payload.toolName}</Text>
          <Text style={styles.detailLine}>Owner: {payload.ownerName}</Text>
          <Text style={styles.detailLine}>Borrower: {payload.borrowerName}</Text>
          <Text style={styles.detailLine}>Started: {payload.startedOn}</Text>
          <Text style={styles.detailLine}>Due: {payload.dueOn ?? 'No due date'}</Text>
          <Text style={styles.reviewNote}>{existing ? 'Re-scanning opens the original local record. It will not overwrite edits or a recorded return.' : 'Saving creates a local copy and records the local user as the borrower. The owner does not receive a notification or confirmation.'}</Text>
          <Button label={existing ? 'Open saved loan' : 'Save a copy'} onPress={() => void saveCopy()} variant="primary" busy={saving} />
          <Button label="Scan another code" onPress={() => { setPayload(undefined); setScanError(undefined); }} variant="quiet" disabled={saving} />
        </Card>
      ) : null}
      <Text style={styles.footer}>Only supported HandBack loan details are accepted. Photos and private notes never travel in the QR code.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraFrame: { backgroundColor: '#05070a', borderColor: colors.line, borderRadius: 18, height: 310, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraStatus: { color: colors.muted, flex: 1, paddingTop: 140, textAlign: 'center' },
  permissionCard: { marginTop: 2 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  cardButton: { marginTop: 13 },
  errorCard: { borderColor: '#6d3c3f', marginTop: 13 },
  errorTitle: { color: colors.danger, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  reviewCard: { marginTop: 15 },
  reviewKicker: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  reviewTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', marginBottom: 11 },
  detailLine: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  reviewNote: { color: colors.dim, fontSize: 12, lineHeight: 18, marginBottom: 15, marginTop: 11 },
  footer: { color: colors.dim, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: 'center' },
});
