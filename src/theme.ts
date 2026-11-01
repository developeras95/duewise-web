import { createTheme } from '@mui/material/styles';

/**
 * Duewise's look: MUI defaults with a calm teal primary colour, light and dark schemes, and
 * slightly tighter components, since this is a data-heavy business app.
 * The colour scheme follows the operating system until the user picks one in the top bar.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0f766e' },
        secondary: { main: '#4f46e5' },
        background: { default: '#f6f7f9' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#2dd4bf' },
        secondary: { main: '#a5b4fc' },
        background: { default: '#0f1214', paper: '#171b1e' },
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 600 },
    h2: { fontSize: '1.25rem', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
});
