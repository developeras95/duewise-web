import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import { ApiError } from '../api/client';

interface ErrorStateProps {
  error: unknown;
  /** Shown as a "Try again" button when given. */
  onRetry?: () => void;
}

/**
 * How a failed request looks everywhere in the app: Duewise's own message, its error code for
 * anyone reporting a problem, and a retry button when retrying makes sense.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError?.message ?? (error instanceof Error ? error.message : 'Something went wrong.');
  const unreachable = apiError?.code === 'NETWORK_ERROR' || (apiError && apiError.status >= 502);

  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <AlertTitle>{unreachable ? 'Cannot reach Duewise' : 'Request failed'}</AlertTitle>
      {message}
      {apiError && !unreachable && (
        <>
          {' '}
          <code>({apiError.code})</code>
        </>
      )}
    </Alert>
  );
}
