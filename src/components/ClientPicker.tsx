import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useClients, type Client } from '../api/clients';
import { useDebouncedValue } from '../lib/useDebouncedValue';

export interface ClientOption {
  id: number;
  name: string;
  email?: string;
}

interface ClientPickerProps {
  value: ClientOption | null;
  onChange: (client: ClientOption | null, full?: Client) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  size?: 'small' | 'medium';
  sx?: object;
}

/**
 * Picks a client by typing part of the name or email. Searches Duewise as you type (20 matches at a
 * time), so it works the same with 10 clients or 50,000.
 */
export function ClientPicker({
  value,
  onChange,
  label = 'Client',
  error,
  helperText,
  required,
  disabled,
  onBlur,
  size = 'small',
  sx,
}: ClientPickerProps) {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());
  const searching = input !== (value?.name ?? '');
  const clients = useClients({ q: searching ? query : '', page: 0, size: 20, sort: 'name', direction: 'asc' });
  const options: ClientOption[] = (clients.data?.content ?? []).map((client) => ({
    id: client.id!,
    name: client.name!,
    email: client.email,
  }));

  return (
    <Autocomplete
      value={value}
      onChange={(_, option) =>
        onChange(option, option ? clients.data?.content?.find((client) => client.id === option.id) : undefined)
      }
      inputValue={input}
      onInputChange={(_, text) => setInput(text)}
      options={value && !options.some((option) => option.id === value.id) ? [value, ...options] : options}
      filterOptions={(all) => all} // Duewise already filtered them
      getOptionLabel={(option) => option.name}
      // Names repeat (two clients can both be "Bluebird Agro Co"), so rows are keyed by id. Keyed by
      // name, React mixed up the rows and kept showing the old list after a new search.
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loading={clients.isFetching}
      disabled={disabled}
      size={size}
      sx={sx}
      noOptionsText={query ? 'No client matches' : 'Type to search'}
      renderOption={({ key, ...props }, option) => (
        <li key={key} {...props}>
          <span>
            {option.name}
            {option.email && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {option.email}
              </Typography>
            )}
          </span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          onBlur={onBlur}
        />
      )}
    />
  );
}
