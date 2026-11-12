import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import TimerIcon from '@mui/icons-material/TimerOutlined';
import { clearTimings, useRequestTimings } from '../api/timing';
import { formatDuration } from '../lib/format';

/** Green under 200 ms, amber under 1 s, red above: roughly what feels instant, noticeable, slow. */
function speedColor(ms: number, status: number) {
  if (status === 0 || status >= 500) return 'error';
  if (ms < 200) return 'success';
  if (ms < 1000) return 'warning';
  return 'error';
}

/**
 * How long the app's calls to Duewise take, as the browser sees them. Shows the latest call in the
 * top bar; click for the last 30. Made for the performance study: open a screen and see its cost.
 */
export function RequestTimingBadge() {
  const timings = useRequestTimings();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const latest = timings[0];

  return (
    <>
      <Tooltip title="How long the latest request to Duewise took. Click for the recent ones.">
        <Chip
          icon={<TimerIcon />}
          label={latest ? formatDuration(latest.ms) : '–'}
          color={latest ? speedColor(latest.ms, latest.status) : 'default'}
          variant="outlined"
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={latest ? `Latest API request took ${formatDuration(latest.ms)}` : 'No API requests yet'}
          sx={{ mr: 1, fontVariantNumeric: 'tabular-nums' }}
        />
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 'min(640px, calc(100vw - 32px))', maxHeight: '70vh' } } }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 600 }}>Recent requests to Duewise</Typography>
            <Typography variant="caption" color="text.secondary">
              Browser to API and back, including the response body. Newest first.
            </Typography>
          </Box>
          <Button size="small" onClick={clearTimings} disabled={timings.length === 0}>
            Clear
          </Button>
        </Box>
        <Table size="small" aria-label="Recent requests">
          <TableHead>
            <TableRow>
              <TableCell>Request</TableCell>
              <TableCell align="right">Status</TableCell>
              <TableCell align="right">Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {timings.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>
                  Nothing yet: open a screen.
                </TableCell>
              </TableRow>
            )}
            {timings.map((timing) => (
              <TableRow key={timing.id}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                  {timing.method} {timing.path}
                </TableCell>
                <TableCell align="right">{timing.status || 'failed'}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Chip
                    label={formatDuration(timing.ms)}
                    size="small"
                    color={speedColor(timing.ms, timing.status)}
                    variant="outlined"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Popover>
    </>
  );
}
