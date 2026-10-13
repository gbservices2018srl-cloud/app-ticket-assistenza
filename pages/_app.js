import '../styles/globals.css';
import InstallaApp from '../components/InstallaApp';
import LinkLegali from '../components/LinkLegali';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <LinkLegali />
      <InstallaApp />
    </>
  );
}
