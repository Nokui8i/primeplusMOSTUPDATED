export const themeColors = {
  brand: {
    blue: {
      primary: '#2B55FF',    // Primary Blue
      deep: '#2B1B5A',       // Deep Purple-Blue
      accent: '#4169E1',     // Royal Blue
    }
  },
  text: {
    primary: '#FFFFFF',      // White text
    secondary: '#E0E0E0',    // Light gray
    dark: '#1A1A1A',        // Almost black
    neon: {
      blue: '#2B55FF',      // Neon blue text
      white: '#FFFFFF',     // White text with glow
    }
  },
  background: {
    primary: '#0F172A',     // Deep blue background
    secondary: '#1E293B',   // Lighter blue background
    light: '#FFFFFF',       // White background
    overlay: 'rgba(15,23,42,0.8)', // Dark overlay
  },
  border: {
    light: 'rgba(255,255,255,0.2)',
    main: 'rgba(43,85,255,0.4)'
  },
  effects: {
    glow: {
      blue: '0 0 30px rgba(43,85,255,0.5)',   // Primary Blue glow
      white: '0 0 20px rgba(255,255,255,0.8)', // White glow
    },
    glass: {
      dark: 'rgba(0,0,0,0.3)',
      light: 'rgba(255,255,255,0.1)'
    }
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
    primary: '#0F172A',     // Deep blue background
    secondary: '#1E293B',   // Lighter blue background
  },
  text: {
    primary: '#FFFFFF',     // White text
    secondary: '#E0E0E0',   // Light gray
  },
  border: 'rgba(255,255,255,0.2)',
  hover: 'rgba(43,85,255,0.3)'
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