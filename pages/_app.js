import '../styles/globals.css';
import InstallaApp from '../components/InstallaApp';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <InstallaApp />
    </>
  );
}
