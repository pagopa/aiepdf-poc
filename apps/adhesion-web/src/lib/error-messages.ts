import { ApiError } from './adhesion-api';
import type { ErrorCode } from './adhesion-contract';

/**
 * Turns any failure into an explanatory, user-facing message.
 *
 * Every known semantic error code has a dedicated message; unknown codes and
 * transport failures fall back to status-based or generic messages, so the UI
 * never shows a raw API payload or a bare "unexpected error".
 */

const messageByErrorCode: Record<ErrorCode, string> = {
  AGREEMENT_EXTENSION_INVALID:
    'Il file selezionato non è nel formato richiesto. Carica un accordo firmato in formato CAdES (.p7m).',
  AGREEMENT_SIGNATURE_INVALID:
    'La firma del documento non è valida o non è in formato CAdES. Fai firmare di nuovo il documento e riprova.',
  AGREEMENT_FILE_TOO_LARGE:
    'Il file supera il limite di dimensione consentito dal servizio. Riduci le dimensioni del file e riprova.',
  PRACTICE_STATE_INVALID:
    "La pratica non è nello stato REQUEST, oppure un accordo è già stato caricato (step 1). Verifica lo stato della pratica prima di riprovare.",
  PRACTICE_NOT_FOUND:
    "La pratica indicata non esiste. Controlla l'ID pratica inserito e riprova.",
  UPLOAD_DISABLED:
    'Il caricamento è temporaneamente disabilitato. Riprova più tardi.',
};

const messageByHttpStatus: Record<number, string> = {
  400: 'La richiesta non è valida. Controlla i dati inseriti e riprova.',
  401: 'Non sei autorizzato a eseguire questa operazione.',
  403: 'Non hai i permessi per eseguire questa operazione.',
  404: 'La risorsa richiesta non è stata trovata.',
  409: "L'operazione non è consentita nello stato attuale della pratica.",
  413: 'Il file inviato è troppo grande. Riduci le dimensioni e riprova.',
  415: 'Il formato del file inviato non è supportato.',
  422: 'I dati inviati non sono validi. Controlla e riprova.',
  429: 'Troppe richieste in poco tempo. Attendi qualche istante e riprova.',
  500: 'Si è verificato un errore nel servizio. Se il problema persiste, contatta l’assistenza.',
  502: 'Il servizio non è raggiungibile in questo momento. Riprova più tardi.',
  503: 'Il servizio non è disponibile in questo momento. Riprova più tardi.',
  504: 'Il servizio non ha risposto in tempo. Riprova più tardi.',
};

export interface ErrorPresentation {
  readonly title: string;
  readonly message: string;
}

const operationFailed: Pick<ErrorPresentation, 'title'> = {
  title: 'Operazione non riuscita',
};

export function describeError(error: unknown): ErrorPresentation {
  if (error instanceof ApiError) {
    // Known semantic code: curated message.
    const mapped = error.errorCode
      ? messageByErrorCode[error.errorCode]
      : undefined;
    if (mapped) {
      return { ...operationFailed, message: mapped };
    }

    // Unknown code or no code: fall back to the HTTP status.
    const byStatus = messageByHttpStatus[error.httpStatus];
    const codeSuffix = error.errorCode ? ` (codice: ${error.errorCode})` : '';
    if (byStatus) {
      return { ...operationFailed, message: `${byStatus}${codeSuffix}` };
    }

    return {
      ...operationFailed,
      message: `Errore imprevisto dal servizio (HTTP ${error.httpStatus})${codeSuffix}. Riprova o contatta l’assistenza.`,
    };
  }

  // A fetch rejected before any response: network, DNS or CORS.
  if (error instanceof TypeError) {
    return {
      title: 'Servizio non raggiungibile',
      message:
        'Impossibile contattare il servizio di adesione. Verifica la connessione e riprova.',
    };
  }

  return {
    title: 'Errore imprevisto',
    message: 'Si è verificato un errore imprevisto. Riprova o contatta l’assistenza.',
  };
}
