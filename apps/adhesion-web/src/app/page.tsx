'use client';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

import {
  getPilotConfig,
  getPractice,
  uploadSignedAgreement,
} from '../lib/adhesion-api';
import type { PilotConfig, PracticeStatus } from '../lib/adhesion-contract';
import {
  describeError,
  type ErrorPresentation,
} from '../lib/error-messages';

const DEFAULT_MAX_UPLOAD_MB = 10;
const ACCEPTED_EXTENSION = '.p7m';

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export default function UploadAgreementPage() {
  const [onboardingId, setOnboardingId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorPresentation | null>(null);
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [status, setStatus] = useState<PracticeStatus | null>(null);
  const [config, setConfig] = useState<PilotConfig>({
    uploadEnabled: true,
    maxUploadMb: DEFAULT_MAX_UPLOAD_MB,
  });

  // The pilot kill switch and the size limit live in Azure App Configuration
  // and reach the UI through GET /config.
  useEffect(() => {
    const controller = new AbortController();
    getPilotConfig(controller.signal)
      .then((loaded) => {
        setConfig(loaded);
        setConfigWarning(null);
      })
      .catch((configError: unknown) => {
        if (isAbortError(configError)) {
          return;
        }
        setConfigWarning(
          'Impossibile leggere la configurazione del servizio: alcuni limiti mostrati potrebbero non essere aggiornati.',
        );
      });
    return () => controller.abort();
  }, []);

  const canSubmit =
    config.uploadEnabled &&
    onboardingId.trim().length > 0 &&
    file !== null &&
    !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !file) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setDocumentId(null);
    setStatus(null);
    try {
      const result = await uploadSignedAgreement({
        onboardingId: onboardingId.trim(),
        file,
      });
      setDocumentId(result.documentId);
      setStatus(result.status);
    } catch (uploadError) {
      if (!isAbortError(uploadError)) {
        setError(describeError(uploadError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefreshStatus() {
    setError(null);
    try {
      const practice = await getPractice({ onboardingId: onboardingId.trim() });
      setStatus(practice.status);
    } catch (statusError) {
      if (!isAbortError(statusError)) {
        setError(describeError(statusError));
      }
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          CED Adhesion
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Carica l&apos;accordo firmato (step 1) per completare la richiesta di
          adesione. Formato accettato: CAdES ({ACCEPTED_EXTENSION}), fino a{' '}
          {config.maxUploadMb} MB.
        </Typography>
      </Stack>

      {!config.uploadEnabled && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Il caricamento è temporaneamente disabilitato. Riprova più tardi.
        </Alert>
      )}

      {configWarning && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {configWarning}
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider' }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={3}>
            <TextField
              label="ID pratica"
              value={onboardingId}
              onChange={(event) => setOnboardingId(event.target.value)}
              required
              fullWidth
              helperText="Identificativo della pratica in stato REQUEST."
            />

            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              disabled={submitting}
            >
              {file ? file.name : 'Seleziona il file firmato'}
              <input
                type="file"
                hidden
                accept={ACCEPTED_EXTENSION}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Button>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canSubmit}
              startIcon={submitting ? <CircularProgress size={20} /> : undefined}
            >
              Carica accordo
            </Button>
          </Stack>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <AlertTitle>{error.title}</AlertTitle>
          {error.message}
        </Alert>
      )}

      {documentId && status && (
        <Alert
          severity="success"
          icon={<CheckCircleOutlineIcon />}
          sx={{ mt: 3 }}
        >
          <AlertTitle>Accordo acquisito</AlertTitle>
          Documento <strong>{documentId}</strong> registrato. Stato pratica:{' '}
          <strong>{status}</strong>.
          <Divider sx={{ my: 2 }} />
          <Button size="small" onClick={handleRefreshStatus} disabled={submitting}>
            Verifica stato pratica
          </Button>
        </Alert>
      )}

      {!documentId && status && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Stato attuale della pratica: <strong>{status}</strong>.
        </Alert>
      )}
    </Container>
  );
}
