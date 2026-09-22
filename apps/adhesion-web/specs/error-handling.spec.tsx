import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@pagopa/mui-italia';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import UploadAgreementPage from '../src/app/page';

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <UploadAgreementPage />
    </ThemeProvider>,
  );
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('upload error handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('shows an explanatory message for PRACTICE_NOT_FOUND', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/config')) {
          return jsonResponse({ uploadEnabled: true, maxUploadMb: 10 }, 200);
        }
        return jsonResponse(
          {
            type: 'https://errors.ced.pagopa.it/practice-not-found',
            title: 'Practice not found',
            status: 404,
            detail: 'The practice does not exist.',
            errorCode: 'PRACTICE_NOT_FOUND',
          },
          404,
        );
      }),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText(/ID pratica/i), {
      target: { value: 'missing-practice' },
    });
    fireEvent.change(screen.getByLabelText(/Seleziona il file firmato/i), {
      target: {
        files: [
          new File(['content'], 'agreement.p7m', {
            type: 'application/pkcs7-mime',
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Carica accordo/i }));

    expect(await screen.findByText(/non esiste/i)).toBeTruthy();
    // The raw API detail is never rendered.
    expect(screen.queryByText(/The practice does not exist/)).toBeNull();
  });

  it('shows an unreachable-service message on a network failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText(/ID pratica/i), {
      target: { value: 'practice-1' },
    });
    fireEvent.change(screen.getByLabelText(/Seleziona il file firmato/i), {
      target: {
        files: [
          new File(['content'], 'agreement.p7m', {
            type: 'application/pkcs7-mime',
          }),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Carica accordo/i }));

    expect(await screen.findByText(/non raggiungibile/i)).toBeTruthy();
  });
});
