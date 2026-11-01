import { Link as RouterLink } from 'react-router';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          There is nothing at this address. It may have been mistyped, or the link is out of date.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/">
          Go to the dashboard
        </Button>
      </Paper>
    </>
  );
}
