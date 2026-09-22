import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@pagopa/mui-italia';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import UploadAgreementPage from '../src/app/page';

describe('UploadAgreementPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders the upload form and the pilot constraints', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ uploadEnabled: true, maxUploadMb: 10 }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    await act(async () => {
      render(
        <ThemeProvider theme={theme}>
          <UploadAgreementPage />
        </ThemeProvider>,
      );
      // Flush the config effect.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole('heading', { name: /CED Adhesion/i })).toBeTruthy();
    expect(screen.getByLabelText(/ID pratica/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Carica accordo/i }),
    ).toBeTruthy();
  });
});
