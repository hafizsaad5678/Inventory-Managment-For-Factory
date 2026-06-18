/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Content must cover all TSX files in src/app and src/components
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          surface: '#F5F1E8',
          cream: '#FAF8F3',
          glass: 'rgba(255, 255, 255, 0.60)',
          primary: '#000000',
          secondary: '#333333',
          muted: '#666666',
          accent: '#412D15',
          'accent-sec': '#5C3D1E',
          success: '#2E7D32',
          danger: '#D64545',
          warning: '#F4A300',
        }
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
