export const themeColors = {
  brand: {
    pink: {
      lightest: '#FF80AB', // Lightest pink
      light: '#FF4081',    // Light pink
      main: '#E91E63',     // Main pink/magenta
      dark: '#C2185B',     // Darker shade
      darkest: '#880E4F'   // Darkest shade for depth
    }
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    light: '#999999'
  },
  background: {
    main: '#FFFFFF',
    light: '#FAFAFA',
    dark: '#F5F5F5'
  },
  border: {
    light: '#EEEEEE',
    main: '#E0E0E0'
  },
  
  // Secondary - Warm Gray
  secondary: {
    main: '#4A5568',     // Warm gray
    dark: '#2D3748',     // Darker gray for hover
    light: '#F7FAFC',    // Light gray for backgrounds
  },
  
  // Accent - Terracotta
  accent: {
    main: '#C53030',     // Warm red
    dark: '#9B2C2C',     // Darker red for hover
    light: '#FFF5F5',    // Very light red for backgrounds
  }
};

export const lightTheme = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F7FAFC',
  },
  text: {
    primary: '#1A202C',    // Almost black
    secondary: '#4A5568',  // Dark gray
  },
  border: '#EDF2F7',       // Light gray border
  hover: '#F7FAFC',        // Light hover
};

export const darkTheme = {
  background: {
    primary: '#1A202C',
    secondary: '#2D3748',
  },
  text: {
    primary: '#F7FAFC',
    secondary: '#A0AEC0',
  },
  border: '#2D3748',
  hover: '#2A4365',
};

export const gradients = {
  primary: 'linear-gradient(to right, #2C5282, #4A5568)',
  secondary: 'linear-gradient(to right, #4A5568, #C53030)',
};

export const statusColors = {
  success: '#38A169',  // Green
  error: '#E53E3E',    // Red
  warning: '#D69E2E',  // Yellow
  info: '#3182CE',     // Blue
}; 