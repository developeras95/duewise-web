import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { PageHeader } from '../components/PageHeader';

interface ComingSoonPageProps {
  title: string;
  description: string;
}

/** Placeholder for a section that is not built yet, saying what it will do. */
export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <>
      <PageHeader title={title} />
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">{description}</Typography>
      </Paper>
    </>
  );
}
