/**
 * PostCSS config — wires Tailwind and Autoprefixer into the build.
 * Tailwind scans the `content` globs in tailwind.config.ts and generates only
 * the utility classes you actually use.
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
