import '@antadesign/anta/bundle.css';
import '../app.css';
export const metadata = { title: 'Anta consumer test', icons: { icon: '/favicon.svg' } };
export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
