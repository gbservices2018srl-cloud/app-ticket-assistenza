import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="it">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#9454FB" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TO Smile" />
        <meta name="description" content="Gestione ticket di assistenza tra studi e amministrazione TO Smile" />
        {/* caratteri dai server di appgestione.it (niente Google Fonts) */}
        <link href="https://appgestione.it/fonts/tosmile.css?f=fredoka:400,500,600,700" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
