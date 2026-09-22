'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@pagopa/mui-italia';

/**
 * Client-side providers for the Adhesion web app.
 *
 * Kept as a client component so the MUI theme (which contains non-serializable
 * values) never crosses the server/client boundary. The next-auth session
 * provider, if authentication is ever introduced, belongs here too.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
