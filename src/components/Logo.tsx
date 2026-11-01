import Box from '@mui/material/Box';

/** Duewise's mark: an invoice sheet with a tick, drawn for this project. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Box component="svg" viewBox="0 0 32 32" width={size} height={size} aria-hidden sx={{ color: 'primary.main' }}>
      <rect x="5" y="3" width="22" height="26" rx="4" fill="currentColor" />
      <path d="M10 10h12M10 15h8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M11.5 21.5l3 3 6-6.5"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}
