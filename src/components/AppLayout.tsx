import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import InvoiceIcon from '@mui/icons-material/ReceiptLongOutlined';
import ClientIcon from '@mui/icons-material/PeopleAltOutlined';
import ReminderIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SettingsIcon from '@mui/icons-material/TuneOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LightIcon from '@mui/icons-material/LightModeOutlined';
import DarkIcon from '@mui/icons-material/DarkModeOutlined';
import { Logo } from './Logo';
import { RequestTimingBadge } from './RequestTimingBadge';

const DRAWER_WIDTH = 232;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/invoices', label: 'Invoices', icon: <InvoiceIcon /> },
  { to: '/clients', label: 'Clients', icon: <ClientIcon /> },
  { to: '/reminders', label: 'Reminders', icon: <ReminderIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <List component="nav" aria-label="Main" sx={{ px: 1 }}>
      {NAV_ITEMS.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          sx={{
            borderRadius: 1,
            mb: 0.5,
            '&.active': { bgcolor: 'action.selected', color: 'primary.main' },
            '&.active .MuiListItemIcon-root': { color: 'primary.main' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}

function ColorSchemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const effective = mode === 'system' ? systemMode : mode;
  if (!effective) {
    return null; // not known until the first render on the client
  }
  const next = effective === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <IconButton color="inherit" onClick={() => setMode(next)} aria-label={`Switch to ${next} mode`}>
        {effective === 'dark' ? <LightIcon /> : <DarkIcon />}
      </IconButton>
    </Tooltip>
  );
}

/**
 * The frame around every page: top bar, navigation on the left (a slide-out menu on small
 * screens) and the page itself in the main area.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>
          <Logo />
          <Typography variant="h6" component="span" sx={{ ml: 1, fontWeight: 700, flexGrow: 1 }}>
            Duewise
          </Typography>
          <RequestTimingBadge />
          <ColorSchemeToggle />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <Toolbar />
          <Navigation onNavigate={() => setMobileOpen(false)} />
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <Navigation />
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
