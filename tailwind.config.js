/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		backgroundImage: {
  			'gradient-primary': 'linear-gradient(to bottom right, #6B3BFF, #2B55FF)',
  			'gradient-elementor': 'linear-gradient(to bottom right, #2B1B5A, #4B3BBA, #4169E1)',
  			'gradient-night': 'linear-gradient(to right, #1e3c72, #2B55FF)',
  			'gradient-pink': 'linear-gradient(to bottom, transparent, #ff69b420)',
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  		},
  		boxShadow: {
  			'glow-blue': '0 0 30px rgba(43,85,255,0.5)',
  			'glow-pink': '0 0 30px rgba(255,105,180,0.5)',
  			'glow-white': '0 0 20px rgba(255,255,255,0.8)',
  		},
  		backdropBlur: {
  			'glass': '10px',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: 0
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: 0
  				}
  			},
  			float: {
  				'0%, 100%': { transform: 'translateY(0) scale(1)' },
  				'50%': { transform: 'translateY(-20px) scale(1.05)' },
  			},
  			twinkle: {
  				'0%, 100%': { opacity: 0.2, transform: 'scale(0.8)' },
  				'50%': { opacity: 1, transform: 'scale(1.2)' },
  			},
  			'twinkle-delayed': {
  				'0%, 100%': { opacity: 0.1 },
  				'50%': { opacity: 0.2 },
  			},
  			'float-x': {
  				'0%, 100%': { transform: 'translateX(0)' },
  				'50%': { transform: 'translateX(40px)' },
  			},
  			'float-y': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(40px)' },
  			},
  			'float-xy': {
  				'0%, 100%': { transform: 'translate(0,0)' },
  				'25%': { transform: 'translate(30px, 20px)' },
  				'50%': { transform: 'translate(0, 40px)' },
  				'75%': { transform: 'translate(-30px, 20px)' },
  			},
  			'float-ellipse': {
  				'0%': { transform: 'translate(0,0)' },
  				'20%': { transform: 'translate(20px, 10px)' },
  				'40%': { transform: 'translate(40px, 0)' },
  				'60%': { transform: 'translate(20px, -10px)' },
  				'80%': { transform: 'translate(0,0)' },
  				'100%': { transform: 'translate(0,0)' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'float': 'float 20s ease-in-out infinite',
  			'float-delayed': 'float 20s ease-in-out infinite 10s',
  			'twinkle': 'twinkle 3s ease-in-out infinite',
  			'twinkle-delayed': 'twinkle 3s ease-in-out infinite 1.5s',
  			'float-x': 'float-x 12s ease-in-out infinite',
  			'float-y': 'float-y 10s ease-in-out infinite',
  			'float-xy': 'float-xy 16s ease-in-out infinite',
  			'float-ellipse': 'float-ellipse 18s linear infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} 